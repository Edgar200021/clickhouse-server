import type {FastifyLoggerOptions, RawServerBase} from "fastify";
import type {PinoLoggerOptions} from "fastify/types/logger.js";
import pino from "pino";
import {Config} from "@/config.js";


export function setupLogger(config: Config["logger"]): FastifyLoggerOptions<RawServerBase> &
	PinoLoggerOptions {


	return {
		timestamp: pino.stdTimeFunctions.isoTime,
		level: config.logLevel,
		base: {pid: process.pid},
		transport: {
			targets: [{
				target: config.structured ? "pino/file" : "pino-pretty",
				options:
					config.structured ? {} : {
						colorize: true,
						ignore: "pid,hostname",
						translateTime: "HH:MM:ss Z",
					},
			}
			],
		},
		mixin(_, level, obj) {
			return {'level-label': pino.levels.labels[level]}
		},
		redact: {paths: ["password"], remove: true},
		serializers: {
			req(req) {
				return {
					method: req.method,
					url: req.url,
					host: req.host,
					remoteAddress: req.ip,
					remotePort: req.socket.remotePort,
					agent: req.headers["user-agent"],
				};
			}
		},

	};
}