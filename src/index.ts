import util from 'node:util'
import { createLogger, format, type Logger, transports } from 'winston'
import { ElysiaLogging } from './elysiaLogging'
import { LogFormat } from './logger-types'

const inspect = (value: unknown) =>
	util.inspect(value, {
		colors: true,
		depth: null,
		compact: false,
		breakLength: 120,
	})

const prettyMeta = format((info) => {
	// Pretty-print the primary message if it's an object
	if (typeof info.message !== 'string') {
		info.message = inspect(info.message)
	}

	// Pretty-print every metadata field
	for (const [key, value] of Object.entries(info)) {
		if (['level', 'message', 'timestamp', 'stack'].includes(key)) continue

		if (value instanceof Error) {
			info[key] = value.stack ?? value.message
		} else if (typeof value === 'object' && value !== null) {
			info[key] = inspect(value)
		}
	}

	return info
})

export const defaultLogger: Logger = createLogger({
	level: Bun.env.LOG_LEVEL ?? 'info', // Note: process.env.LOG_LEVEL is more standard if you want Node compatibility, but Bun.env is fine for pure Bun
	format: format.combine(
		format.colorize(),
		prettyMeta(),
		format.errors({ stack: true }),
		format.splat(),
		format.timestamp({ format: 'YYYY-MM-DD hh:mm:ss.SSS A' }),
		format.printf(({ timestamp, level, message }) => {
			return `[${timestamp}] ${level}: ${message}`
		}),
	),
	transports: [new transports.Console()],
})

export const winstonLogger = (customLogger?: Logger, options?: { level?: string; format?: (typeof LogFormat)[keyof typeof LogFormat] }) => {
	// If they pass their own logger, use it. Otherwise use your default.
	const loggerToUse = customLogger ?? defaultLogger

	// Provide sensible defaults if they don't pass options
	const pluginOptions = {
		level: options?.level ?? 'info',
		format: options?.format ?? LogFormat.JSON,
	}

	return ElysiaLogging(loggerToUse, pluginOptions)
}
