import type {ResetPasswordRequest} from "@/schemas/auth/reset-password.schema.js";
import type {FastifyBaseLogger} from "fastify";
import {ResetPasswordPrefix} from "@/const/redis.js";
import {assertValidUser} from "@/utils/user.utils.js";
import {AuthService} from "./auth.service.js";
import {sql} from "kysely";


export async function resetPassword(
	this: AuthService,
	data: ResetPasswordRequest,
	log: FastifyBaseLogger,
) {
	const {redis, httpErrors, kysely, passwordManager} = this.fastify

	const email = await redis.getdel(`${ResetPasswordPrefix}${data.token}`);

	if (!email) {
		log.info("Token not found");
		throw httpErrors.notFound("Token not found");
	}

	const user = await kysely
		.selectFrom("users")
		.select(["id", "isBanned", "isVerified"])
		.where("email", "=", email.toLowerCase())
		.executeTakeFirst();

	assertValidUser(user, log, httpErrors, {
		prefix: "Reset password failed:",
		checkConditions: ["undefined", "banned", "notVerified"],
	});

	const hashedPassword = await passwordManager.hash(data.newPassword);

	await kysely
		.updateTable("users")
		.set("password", hashedPassword)
		.set("updatedAt", sql`NOW
    ()`)
		.where("email", "=", email.toLowerCase())
		.execute();
}