import fp from "fastify-plugin"
import type {ConfigOptions} from "cloudinary";
import client from "prom-client"


export default fp(
	async (instance, opts: ConfigOptions) => {
		client.collectDefaultMetrics({})
	},
	{name: "prometheus"},
)