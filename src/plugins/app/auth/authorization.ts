import type { FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type { UserRole } from "../../../types/db/db.js";

declare module "fastify" {
	export interface FastifyRequest {
		hasPermission: typeof hasPermission;
	}
}

function hasPermission(
	this: FastifyRequest,
	reply: FastifyReply,
	roles: UserRole[],
) {
	if (!this.user) return reply.unauthorized("Unauthorized");

	if (!roles.includes(this.user.role)) {
		return reply.forbidden("Access denied");
	}
}

export default fp(
	async (fastify) => {
		fastify.decorateRequest("hasPermission", hasPermission);
	},
	{
		name: "authorization",
	},
);
