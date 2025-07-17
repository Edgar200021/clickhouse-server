import path from "node:path";
import type { FastifyLoggerOptions, RawServerBase } from "fastify";
import type { PinoLoggerOptions } from "fastify/types/logger.js";
import pino from "pino";

const logInfoPath = process.env.LOG_INFO_PATH
	? path.resolve(process.env.LOG_INFO_PATH)
	: path.join(import.meta.dirname, "../logs/info.log");

const logWarnPath = process.env.LOG_WARN_PATH
	? path.resolve(process.env.LOG_WARN_PATH)
	: path.join(import.meta.dirname, "../logs/warn.log");

const logErrorPath = process.env.LOG_ERROR_PATH
	? path.resolve(process.env.LOG_ERROR_PATH)
	: path.join(import.meta.dirname, "../logs/error.log");

export function setupLogger(): FastifyLoggerOptions<RawServerBase> &
	PinoLoggerOptions {
	const logToFile = process.env.LOG_TO_FILE?.trim() === "true";
	const level = process.env.LOG_LEVEL || "info";

	if (logToFile) {
		return {
			level,
			transport: {
				targets: [
					...["info", "warn", "error", "fatal"].map((level) => {
						const destination =
							level === "info"
								? logInfoPath
								: level === "warn"
									? logWarnPath
									: logErrorPath;

						return {
							level,
							target: "pino/file",
							options: {
								destination,
								mkdir: true,
								ignore: "pid,hostname",
							},
						};
					}),
				],
				dedupe: true,
			},
			timestamp: pino.stdTimeFunctions.isoTime,
			redact: { paths: ["password"], remove: true },
			serializers: {
				req(req) {
					return {
						method: req.method,
						url: req.originalUrl,
						agent: req.headers["user-agent"],
						remoteAddress: req.ip,
					};
				},
			},
		};
	} else {
		return {
			level: "debug",
			transport: {
				target: "pino-pretty",
				options: {
					colorize: true,
					ignore: "pid,hostname",
					translateTime: "HH:MM:ss Z",
				},
			},
			redact: { paths: ["password"], remove: true },
		};
	}
}
