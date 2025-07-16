import fastifyRateLimit, {
	type CreateRateLimitOptions,
} from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";

export const autoConfig = (
	fastify: FastifyInstance,
): CreateRateLimitOptions => {
	return {
		max: fastify.config.rateLimit.globalLimit,
		timeWindow: "1 minute",
	};
};

export default fastifyRateLimit;
