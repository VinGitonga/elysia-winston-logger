# @vingitonga/elysia-winston-logger

A flexible, beautifully formatted Winston logging plugin for ElysiaJS applications

This package provides a ready-to-use logger with gorgeous console formatting (powered by Winston), automatic request logging, and the ability to inject your own custom Winston instances.

# Installation

Since Elysia is built for Bun, the recommended way to install is via Bun:

```bash
bun add @vingitonga/elysia-winston-logger
```

You can also use npm, pnpm, or yarn:

```bash
npm install @vingitonga/elysia-winston-logger
```

# Usage

## Basic Usage (Zero Config)

Out of the box, the plugin provides a beautifully formatted console logger that handles objects, errors, and metadata gracefully. Simply import winstonLogger and register it as an Elysia plugin.

```ts
import { Elysia } from "elysia";
import { winstonLogger } from "@vingitonga/elysia-winston-logger";

const app = new Elysia()
  // 1. Register the plugin
  .use(winstonLogger())

  // 2. Access the logger from the route context
  .get("/", ({ log }) => {
    log.info("Processing root request...");

    // Objects and errors are automatically pretty-printed!
    log.error(new Error("Example error formatting"));
    log.debug({ user: "Alice", role: "Admin" });

    return "Check your console!";
  })
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
```

## Advanced Configuration

You can customize the log level and format, or even pass in your own completely custom Winston instance.

```ts
import { Elysia } from "elysia";
import { createLogger, transports } from "winston";
import { winstonLogger, LogFormat } from "@vingitonga/elysia-winston-logger";

// Option A: Tweak the built-in logger's settings
const app1 = new Elysia().use(
  winstonLogger(undefined, {
    level: "debug",
    format: LogFormat.JSON,
  }),
);

// Option B: Pass your own completely custom Winston logger
const myCustomLogger = createLogger({
  level: "warn",
  transports: [
    new transports.File({ filename: "error.log", level: "error" }),
    new transports.Console(),
  ],
});

const app2 = new Elysia().use(winstonLogger(myCustomLogger));
```

# API Reference

## winstonLogger(customLogger?, options?)

The main plugin factory function.

- `customLogger` (Optional): A custom winston.Logger instance. If omitted, it falls back to the beautifully formatted defaultLogger.

- `options` (Optional): Configuration object.

  - level (string): The minimum level to log (e.g., 'info', 'debug', 'error'). Defaults to Bun.env.LOG_LEVEL or 'info'.

  - format: The output format. Accepts values defined in the LogFormat object.

## Context Injection (log)

Once registered, the logger is injected into the Elysia context as log.

```ts
app.post("/users", ({ log, body }) => {
  log.info("Received body:", body);
});
```

## defaultLogger

The raw Winston instance used by the plugin under the hood. Exported in case you need to use the exact same logger instance outside of the Elysia request lifecycle (e.g., in background jobs, database connection files, or setup scripts).

```ts
import { defaultLogger } from "@vingitonga/elysia-winston-logger";

defaultLogger.info("Database connected successfully!");
```

# License

## MIT
