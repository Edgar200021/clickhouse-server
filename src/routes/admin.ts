import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import {
	ErrorResponseSchema,
	SuccessResponseSchema,
} from "../schemas/base.schema.js";
import { UserRole } from "../types/db/db.js";

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
	const { kysely, httpErrors, emailManager, passwordManager, redis, config } =
		fastify;

	fastify.addHook("onRequest", async (req, reply) => {
		await req.authenticate(reply);
		req.hasPermission(reply, [UserRole.Admin]);
	});

	fastify.get(
		"/admin",
		{
			preHandler: async (req, reply) => {
				await req.authenticate(reply);
			},
		},
		async (req, reply) => {
			reply.status(200).send({
				route: "admin",
			});
		},
	);

	fastify.post(
		"/admin/products",
		{
			preHandler: async (req, reply) => {
				await req.authenticate(reply);
			},
		},
		async (req, reply) => {
			reply.status(200).send({
				route: "admin",
			});
		},
	);
};

export default plugin;
