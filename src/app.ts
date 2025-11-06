import { randomUUID } from "node:crypto";
import path from "node:path";
import fastifyAutoload from "@fastify/autoload";
import { ajvFilePlugin } from "@fastify/multipart";
import fastifySchedule from "@fastify/schedule";
import Fastify, { type FastifyLoggerOptions } from "fastify";
import {
	serializerCompiler,
	validatorCompiler,
	type ZodTypeProvider,
} from "fastify-type-provider-zod";
import type { Config } from "./config.js";

export async function buildApp(config: Config, logger: FastifyLoggerOptions) {
	const app = Fastify({
		logger,
		genReqId: () => randomUUID().toString(),
		trustProxy: true,
		ajv: {
			plugins: [ajvFilePlugin],
		},
	}).withTypeProvider<ZodTypeProvider>();

	app.register(fastifySchedule);

	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);

	app.decorate("config", config);

	await app.register(fastifyAutoload, {
		dir: path.join(import.meta.dirname, "plugins/external"),
		options: { ...app.options },
	});

	app.register(fastifyAutoload, {
		dir: path.join(import.meta.dirname, "plugins/internal"),
		options: { ...app.options },
	});

	app.register(fastifyAutoload, {
		dir: path.join(import.meta.dirname, "services"),
		matchFilter: /.*\.service\.ts$/,
		options: { ...app.options },
	});

	app.register(fastifyAutoload, {
		dir: path.join(import.meta.dirname, "routes"),
		options: {
			...app.options,
			prefix: "/api",
			autoHooks: true,
			cascadeHooks: true,
		},
	});

	await app.ready();

	return app;
}
