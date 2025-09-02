import { randomUUID } from "node:crypto";
import path from "node:path";
import fastifyAutoload from "@fastify/autoload";
import { ajvFilePlugin } from "@fastify/multipart";
import Fastify from "fastify";
import {
	hasZodFastifySchemaValidationErrors,
	isResponseSerializationError,
	serializerCompiler,
	validatorCompiler,
	type ZodTypeProvider,
} from "fastify-type-provider-zod";
import type { Config } from "./config.js";
import { setupLogger } from "./logger.js";

export async function buildApp(config: Config) {
	const app = Fastify({
		logger: setupLogger(),
		genReqId: () => randomUUID().toString(),
		trustProxy: true,
		ajv: {
			plugins: [ajvFilePlugin],
		},
	}).withTypeProvider<ZodTypeProvider>();

	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);

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
		if (err.statusCode === 429) {
			return reply.status(429).send({
				status: "error",
				error: "You hit the rate limit! Slow down please!",
			});
		}

		if (hasZodFastifySchemaValidationErrors(err)) {
			return reply.code(400).send({
				status: "error",
				errors: (
					err.validation as { instancePath: string; message: string }[]
				).reduce((acc: Record<string, string>, err) => {
					if (!acc[err.instancePath]) {
						acc[err.instancePath.slice(1)] = err.message;
					}

					return acc;
				}, {}),
			});
		}

		if (isResponseSerializationError(err)) {
			console.log(err);
			app.log.error(
				{
					name: err.name,
					message: err.message,
					stack: err.stack,
					request: {
						method: req.method,
						url: req.url,
						query: req.query,
						params: req.params,
					},
				},
				"Response serialization error",
			);
			return reply.code(500).send({
				status: "error",
				error: "Response doesn't match the schema",
			});
		}

		if (err instanceof app.httpErrors.HttpError) {
			return reply
				.status(err.statusCode)
				.send({ status: "error", error: err.message });
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

		reply.status(500).send({ status: "error", error: "Internal Server Error" });
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
