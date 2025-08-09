import { type ConfigOptions, v2 as cloudinary } from "cloudinary";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
	interface FastifyInstance {
		cloudinary: typeof cloudinary;
	}
}

export const autoConfig = (fastify: FastifyInstance): ConfigOptions => {
	const { apiKey, apiSecret, secure, cloudName } = fastify.config.cloudinary;
	return {
		cloud_name: cloudName,
		api_key: apiKey,
		api_secret: apiSecret,
		secure,
	};
};

export default fp(
	async (instance, opts: ConfigOptions) => {
		cloudinary.config(opts);
		instance.decorate("cloudinary", cloudinary);
	},
	{ name: "cloudinary" },
);
