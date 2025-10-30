import { httpErrors } from "@fastify/sensible";
import type { FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type { UserRole } from "@/types/db/db.js";

declare module "fastify" {
	export interface FastifyRequest {
		hasPermission: typeof hasPermission;
	}
}
async function hasPermission(this: FastifyRequest, roles: UserRole[]) {
	if (!this.user) throw httpErrors.unauthorized("Unauthorized");

	if (!roles.includes(this.user.role)) {
		throw httpErrors.forbidden("Access denied");
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