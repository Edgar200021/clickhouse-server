import redis, { type FastifyRedisPluginOptions } from "@fastify/redis";
import type { FastifyInstance } from "fastify/types/instance.js";
import fp from "fastify-plugin";

export const autoConfig = (
	fastify: FastifyInstance,
): FastifyRedisPluginOptions => ({
	host: fastify.config.redis.host,
	port: fastify.config.redis.port,
	password: fastify.config.redis.password,
	db: fastify.config.redis.db,
});

export default fp(redis, {
	name: "redis",
});
