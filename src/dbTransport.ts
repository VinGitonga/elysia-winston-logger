import Transport, { type TransportStreamOptions } from 'winston-transport'

export interface DbLogEntry {
	level: string
	message: string
	meta: Record<string, unknown> | null
}

export type DbInsertFn = (entry: DbLogEntry) => Promise<void> | void

export interface DbTransportOptions extends TransportStreamOptions {
	insert: DbInsertFn
}

const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}.[0-9;]*m`, 'g')

const stripAnsi = (value: string): string => value.replace(ANSI_PATTERN, '')

const stringifyMessage = (message: unknown): string => {
	if (typeof message === 'string') return stripAnsi(message)
	if (message instanceof Error) return stripAnsi(message.stack ?? message.message)
	if (typeof message === 'object' && message !== null) {
		try {
			return stripAnsi(JSON.stringify(message) ?? String(message))
		} catch {
			return String(message)
		}
	}
	return String(message)
}

const normalizeMeta = (meta: Record<string, unknown>): Record<string, unknown> => {
	const normalized: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(meta)) {
		if (value instanceof Error) {
			normalized[key] = stripAnsi(value.stack ?? value.message)
		} else if (typeof value === 'string') {
			normalized[key] = stripAnsi(value)
		} else {
			normalized[key] = value
		}
	}
	return normalized
}

export class DbTransport extends Transport {
	private readonly insert: DbInsertFn

	constructor(options: DbTransportOptions) {
		super(options)
		this.insert = options.insert
	}

	async log(info: any, callback: () => void) {
		setImmediate(() => {
			this.emit('logged', info)
		})

		const { level, message, ...meta } = info

		try {
			await this.insert({
				level: stripAnsi(level),
				message: stringifyMessage(message),
				meta: Object.keys(meta).length ? normalizeMeta(meta) : null,
			})
		} catch (error) {
			console.error('Error saving log to database:', error)
		}

		callback()
	}
}
