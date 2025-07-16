import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

export default fp(async (fastify: FastifyInstance) => {
	await fastify.register(fastifySwagger, {
		hideUntagged: true,
		openapi: {
			info: {
				title: "Clickhouse API",
				version: "0.0.0",
			},
		},
	});

	await fastify.register(fastifySwaggerUi, {
		routePrefix: "/api/docs",
	});
});
