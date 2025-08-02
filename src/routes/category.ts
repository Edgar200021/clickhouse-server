import {
	type FastifyPluginAsyncTypebox,
	Type,
} from "@fastify/type-provider-typebox";
import { SuccessResponseSchema } from "../schemas/base.schema.js";
import { CategorySchema } from "../schemas/category/category.schema.js";

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
	const { categoryService } = fastify;

	fastify.get(
		"/categories",
		{
			schema: {
				response: {
					200: SuccessResponseSchema(Type.Array(CategorySchema)),
				},
			},
		},
		async (_, reply) => {
			const data = await categoryService.getCategories();

			reply.status(200).send({
				status: "success",
				data,
			});
		},
	);
};

export default plugin;
