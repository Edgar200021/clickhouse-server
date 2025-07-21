import { randomUUID } from "node:crypto";
import path from "node:path";
import fastifyAutoload from "@fastify/autoload";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Ajv } from "ajv";
import ajvFormats from "ajv-formats";
import Fastify from "fastify";
import type { Config } from "./config.js";
import { setupLogger } from "./logger.js";

export async function buildApp(config: Config) {
	const ajv = ajvFormats.default(
		new Ajv({
			removeAdditional: true,
			coerceTypes: true,
			allErrors: true,
		}),
	);

	const app = Fastify({
		logger: setupLogger(),
		genReqId: () => randomUUID().toString(),
		trustProxy: true,
	})
		.withTypeProvider<TypeBoxTypeProvider>()
		.setValidatorCompiler(({ schema }) => ajv.compile(schema));

	app.decorate("config", config);

	await app.register(fastifyAutoload, {
		dir: path.join(import.meta.dirname, "plugins/external"),
		options: { ...app.options },
	});

	app.register(fastifyAutoload, {
		dir: path.join(import.meta.dirname, "plugins/app"),
		options: { ...app.options },
	});

	app.register(fastifyAutoload, {
		dir: path.join(import.meta.dirname, "routes"),
		options: { ...app.options, prefix: "/api/v1" },
	});

	app.setErrorHandler((err, req, reply) => {
		if (err.validation) {
			const errors = err.validation.reduce(
				(acc: Record<string, string[]>, val) => {
					if (!val.message) return acc;
					if (val.keyword === "required") {
						acc[val.params.missingProperty as string] = [val.message];
						return acc;
					}

					const normalizedPath = val.instancePath.slice(1);
					if (acc[normalizedPath]) {
						acc[normalizedPath].push(val.message);
						return acc;
					}

					acc[normalizedPath] = [val.message];
					return acc;
				},
				{},
			);

			reply.status(400);
			return { status: "error", errors };
		}

		if (err.statusCode === 429) {
			reply.code(429);
			return {
				status: "error",
				error: "You hit the rate limit! Slow down please!",
			};
		}

		if (err instanceof app.httpErrors.HttpError) {
			reply.status(err.statusCode);
			return { status: "error", error: err.message };
		}

		app.log.error(
			{
				err,
				request: {
					method: req.method,
					url: req.url,
					query: req.query,
					params: req.params,
				},
			},
			"Unhandled error occurred",
		);

		reply.status(500);
		return { error: "Internal Server Error" };
	});

	app.setNotFoundHandler(
		{
			preHandler: app.rateLimit({
				max: app.config.rateLimit.notFoundLimit,
				timeWindow: 500,
			}),
		},
		(request, reply) => {
			request.log.warn(
				{
					request: {
						method: request.method,
						url: request.url,
						query: request.query,
						params: request.params,
					},
				},
				"Resource not found",
			);

			reply.code(404);

			return { message: "Not Found" };
		},
	);

	await app.ready();

	return app;
}
