import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import {
	ErrorResponseSchema,
	SuccessResponseSchema,
} from "../schemas/base.schema.js";
import { UserSchema } from "../schemas/user.schema.js";

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
	const { kysely, httpErrors, emailManager, passwordManager, redis, config } =
		fastify;

	fastify.get(
		"/user",
		{
			preHandler: async (req, reply) => {
				await req.authenticate(reply);
			},
			schema: {
				response: {
					200: SuccessResponseSchema(UserSchema),
					401: ErrorResponseSchema,
				},
			},
		},
		async (req, reply) => {
			const user = req.user;

			if (!user) return reply.unauthorized("Unautorized");

			reply.status(200).send({
				status: "success",
				data: {
					id: user.id,
					createdAt: user.createdAt.toISOString(),
					updatedAt: user.updatedAt.toISOString(),
					email: user.email,
					isVerified: user.isVerified,
					role: user.role,
				},
			});
		},
	);
};

export default plugin;
