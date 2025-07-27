import formbody from "@fastify/formbody";
import multipart from "@fastify/multipart";
import fp from "fastify-plugin";

export default fp(async (instance) => {
	await Promise.all([
		instance.register(formbody),
		instance.register(multipart),
	]);
});
