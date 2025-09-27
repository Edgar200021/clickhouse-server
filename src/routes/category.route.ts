import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import z from "zod";
import { SuccessResponseSchema } from "../schemas/base.schema.js";
import { CategorySchema } from "../schemas/category/category.schema.js";

const plugin: FastifyPluginAsyncZod = async (fastify) => {
	const { categoryService, config } = fastify;

	fastify.get(
		"/categories",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: config.rateLimit.getCategoriesLimit,
				},
			},
			schema: {
				response: {
					200: SuccessResponseSchema(z.array(CategorySchema)),
				},
				tags: ["Categories"],
			},
		},
		async (_, reply) => {
			const data = await categoryService.getAll();

			reply.status(200).send({
				status: "success",
				data,
			});
		},
	);
};

export default plugin;
