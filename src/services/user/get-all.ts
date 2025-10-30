import type {GetUsersRequestQuery} from "@/schemas/user/get-users.schema.js";
import type {WithPageCount} from "@/types/base.js";
import type {User} from "@/types/db/user.js";
import {sql} from "kysely";
import {type UserService} from "@/services/user/user.service.js";

export async function getAll(
	this: UserService,
	query: GetUsersRequestQuery,
): Promise<WithPageCount<Omit<User, "password" | "role">[], "users">> {
	const {kysely} = this.fastify

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
		.where((eb) => this.buildFilters(query, eb))
		.limit(query.limit)
		.offset(query.limit * query.page - query.limit)
		.execute();

	const {totalCount} = await kysely
		.selectFrom("users")
		.select(sql<number>`COUNT(*)::INTEGER`.as("totalCount"))
		.where((eb) => this.buildFilters(query, eb))
		.executeTakeFirstOrThrow();

	return {pageCount: Math.ceil(totalCount / query.limit), users};
}