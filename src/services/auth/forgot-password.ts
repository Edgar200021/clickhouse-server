import type {ForgotPasswordRequest} from "@/schemas/auth/forgot-password.schema.js";
import type {FastifyBaseLogger} from "fastify";
import {assertValidUser} from "@/utils/user.utils.js";
import {randomBytes} from "node:crypto";
import {ResetPasswordPrefix} from "@/const/redis.js";
import {AuthService} from "./auth.service.js";


export async function forgotPassword(
	this: AuthService,
	data: ForgotPasswordRequest,
	log: FastifyBaseLogger,
) {
	const {kysely, httpErrors, redis, config, emailManager} = this.fastify

	const user = await kysely
		.selectFrom("users")
		.select(["id", "email", "isVerified", "isBanned"])
		.where("email", "=", data.email.toLowerCase())
		.executeTakeFirst();

	assertValidUser(user, log, httpErrors, {
		prefix: "Forgot password failed:",
		checkConditions: ["undefined", "notVerified", "banned"],
	});

	const token = randomBytes(16).toString("hex");

	await Promise.all([
		redis.setex(
			`${ResetPasswordPrefix}${token}`,
			60 * config.application.resetPasswordTTLMinutes,
			user!.email,
		),
		emailManager.sendResetPasswordEmail(user!.email, token, (err) => {
			log.error({err}, "Failed to send reset password email");
		}),
	]);
}