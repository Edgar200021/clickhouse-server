import fastifyCookie, { type FastifyCookieOptions } from "@fastify/cookie";
import type { FastifyInstance } from "fastify/types/instance.js";
import fp from "fastify-plugin";

export const autoConfig = (fastify: FastifyInstance): FastifyCookieOptions => ({
	secret: fastify.config.application.cookieSecret,
	parseOptions: {
		path: "/",
		httpOnly: true,
		signed: true,
		secure: fastify.config.application.cookieSecure === "true",
	},
});

export default fp(fastifyCookie);
