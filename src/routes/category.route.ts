import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import z from "zod";
import { SuccessResponseSchema } from "../schemas/base.schema.js";
import { CategorySchema } from "../schemas/category/category.schema.js";

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
	const { categoryService } = fastify;

	fastify.get(
		"/categories",
		{
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
