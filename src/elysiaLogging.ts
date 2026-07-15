import process from 'node:process'
import { Elysia } from 'elysia'
import { getFormattingMethodName, getIP } from './helpers'
import { Log } from './log'
import type { IPHeaders, Logger, LogObject, RequestLoggerOptions } from './logger-types'

/**
 * List of IP headers to check in order of priority.
 *
 * @remarks
 * The order of the headers in this list determines the priority of the headers to use when determining the client IP address.
 * If the first header is not present, the second header is checked, and so on.
 */
export const headersToCheck: IPHeaders[] = [
	'x-forwarded-for', // X-Forwarded-For is the de-facto standard header
	'x-real-ip', // Nginx proxy/FastCGI
	'x-client-ip', // Apache [mod_remoteip](https://httpd.apache.org/docs/2.4/mod/mod_remoteip.html#page-header)
	'cf-connecting-ip', // Cloudflare
	'fastly-client-ip', // Fastly
	'x-cluster-client-ip', // GCP
	'x-forwarded', // RFC 7239
	'forwarded-for', // RFC 7239
	'forwarded', // RFC 7239
	'appengine-user-ip', // GCP
	'true-client-ip', // Akamai and Cloudflare
	'cf-pseudo-ipv4', // Cloudflare
]

/**
 * Creates a middleware function that logs incoming requests and outgoing responses.
 *
 * @param logger - The logger object to use for logging. Defaults to console.
 * @param options - The options object to configure the middleware.
 * @param options.level - The log level to use. Defaults to "info".
 * @param options.format - The log format to use. Can be a string or a function. Defaults to "json".
 * @param options.skip - A function that returns true to skip logging for a specific request.
 * @param options.includeHeaders - An array of headers to include in the log.
 * @param options.ipHeaders - An array of headers to check for the client IP address.
 *
 * @returns A middleware function that logs incoming requests and outgoing responses.
 */
export function ElysiaLogging(logger: Logger = console, options: RequestLoggerOptions = {}) {
	const { level = 'info', format = 'json', skip = undefined, includeHeaders = ['x-forwarded-for', 'authorization'], ipHeaders = headersToCheck } = options

	if (typeof format === 'string' && getFormattingMethodName(format) in Log.prototype === false) {
		throw new Error(`Formatter '${format}' not found!`)
	}

	return new Elysia({ name: 'logger' })
		.derive({ as: 'global' }, ({ request, server }) => {
			const clientIP = server ? (getIP(request.headers, ipHeaders) ?? server.requestIP(request)?.address ?? undefined) : undefined
			return { ip: clientIP }
		})
		.derive({ as: 'global' }, () => ({
			log: logger,
		}))
		.onError(({ store, error }) => {
			;(store as { error?: unknown }).error = error
		})
		.onRequest(({ store }) => {
			;(store as { requestStart?: bigint }).requestStart = process.hrtime.bigint()
		})
		.onAfterHandle(({ store }) => {
			;(store as { responseSize?: unknown }).responseSize = undefined
		})
		.onAfterResponse((ctx) => {
			if (skip && typeof skip === 'function' && skip(ctx)) {
				return
			}

			let duration: number = 0

			if ((ctx.store as { requestStart?: bigint }).requestStart !== undefined && typeof (ctx.store as { requestStart?: bigint }).requestStart === 'bigint') {
				duration = Number(process.hrtime.bigint() - (ctx.store as { requestStart: bigint }).requestStart)
			}

			const logObject: Log = new Log({
				request: {
					ip: ctx.ip,
					method: ctx.request.method,
					url: {
						path: ctx.path,
						params: Object.fromEntries(new URLSearchParams(new URL(ctx.request.url).search)),
					},
				},
				response: {
					status_code: ctx.set.status,
					time: duration,
				},
			})

			if ((ctx.store as { error?: string | Error | object }).error !== undefined) {
				logObject.error = (ctx.store as { error: string | Error | object }).error
			}

			// Add request ID if it exists
			if (ctx.request.headers.has('x-request-id')) {
				logObject.log.request.requestID = ctx.request.headers.get('x-request-id')!
			}

			// Include headers
			for (const header of includeHeaders) {
				if (ctx.request.headers.has(header)) {
					logObject.log.request.headers = {
						...logObject.log.request.headers,
						[header]: ctx.request.headers.get(header)!,
					}
				}
			}

			let logOutput: string | LogObject

			// If the log format is a function, call it and log the output
			if (typeof format === 'function') {
				logOutput = format(logObject.log)
			} else if (typeof format === 'string') {
				const formattingMethod = getFormattingMethodName(format) as Exclude<Exclude<Exclude<keyof typeof logObject, 'prototype'>, 'log'>, 'error'>
				logOutput = logObject[formattingMethod]()
			} else {
				throw new Error(`Invalid formatting method type '${typeof format}'!`)
			}

			// This invokes, e.g. `logger.info(logOutput)` for any given level
			logger[level as keyof typeof logger](logOutput)
		})
		.as('global')
}
