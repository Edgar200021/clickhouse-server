import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import type {
	Expression,
	ExpressionBuilder,
	ExpressionWrapper,
	SqlBool,
} from "kysely";
import type { GetUsersRequestQuery } from "@/schemas/user/get-users.schema.js";
import { blockToggle } from "@/services/user/block-toggle.js";
import { deleteNotVerifiedUsers } from "@/services/user/delete-not-verified-users.js";
import { getAll } from "@/services/user/get-all.js";
import { type DB, UserRole } from "@/types/db/db.js";

declare module "fastify" {
	export interface FastifyInstance {
		userService: UserService;
	}
}

export class UserService {
	getAll = getAll;
	blockToggle = blockToggle;
	deleteNotVerifiedUsers = deleteNotVerifiedUsers;

	constructor(readonly fastify: FastifyInstance) {
		this.buildFilters = this.buildFilters.bind(this);
	}

	buildFilters(
		query: GetUsersRequestQuery,
		eb: ExpressionBuilder<DB, "users">,
	): ExpressionWrapper<DB, "users", SqlBool> {
		const ands: Expression<SqlBool>[] = [eb("role", "!=", UserRole.Admin)];

		if (query.search) {
			ands.push(eb("email", "ilike", `%${query.search}%`));
		}

		if (query.isBanned !== undefined) {
			ands.push(eb("isBanned", "=", query.isBanned));
		}

		if (query.isVerified !== undefined) {
			ands.push(eb("isVerified", "=", query.isVerified));
		}

		return eb.and(ands);
	}
}

export default fp(
	async (fastify: FastifyInstance) => {
		fastify.decorate("userService", new UserService(fastify));
	},
	{
		name: "userService",
	},
);
