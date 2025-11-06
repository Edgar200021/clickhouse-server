import type {FastifyPluginAsyncZod} from "fastify-type-provider-zod";
import client from "prom-client";

const plugin: FastifyPluginAsyncZod = async (fastify) => {
	fastify.get("/", {
		handler: async (_, reply) => {
			const metrics = await client.register.metrics()

			reply.status(200).header("content-type", client.register.contentType).send(metrics)
		}
	})
}

export default plugin