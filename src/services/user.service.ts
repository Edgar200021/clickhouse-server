import type { FastifyInstance } from "fastify/types/instance.js";
import {
	type Expression,
	type ExpressionBuilder,
	type ExpressionWrapper,
	type SqlBool,
	sql,
} from "kysely";

import type { GetUsersRequestQuery } from "../schemas/user/getUsers.schema.js";
import type { WithCount } from "../types/base.js";
import { type DB, UserRole } from "../types/db/db.js";
import type { User } from "../types/db/user.js";

export function createUserService(instance: FastifyInstance) {
	const { kysely, httpErrors } = instance;

	async function getUsers(
		query: GetUsersRequestQuery,
	): Promise<WithCount<Omit<User, "password" | "role">[], "users">> {
		const users = await kysely
			.selectFrom("users")
			.select([
				"id",
				"createdAt",
				"updatedAt",
				"email",
				"isVerified",
				"isBanned",
				"facebookId",
				"googleId",
			])
			.where((eb) => buildFilters(query, eb))
			.limit(query.limit)
			.offset(query.limit * query.page - query.limit)
			.execute();

		const { totalCount } = await kysely
			.selectFrom("users")
			.select(sql<number>`COUNT(*)::INTEGER`.as("totalCount"))
			.where((eb) => buildFilters(query, eb))
			.executeTakeFirstOrThrow();

		return { totalCount, users };
	}

	function buildFilters(
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

	return {
		getUsers,
	};
}
