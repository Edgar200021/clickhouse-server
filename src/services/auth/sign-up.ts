import type {FastifyBaseLogger} from "fastify";
import {randomBytes} from "node:crypto";
import {SignUpRequest} from "@/schemas/auth/sign-up.schema.js";
import {sql} from "kysely";
import {VerificationPrefix} from "@/const/redis.js";
import {AuthService} from "./auth.service.js";


export async function signUp(this: AuthService, data: SignUpRequest, log: FastifyBaseLogger) {
	const {kysely, passwordManager, emailManager, redis, config, httpErrors} = this.fastify

	const {email, password} = data;

	const user = await kysely
		.selectFrom("users")
		.select("id")
		.where("email", "=", email.toLowerCase())
		.executeTakeFirst();

	if (user) {
		log.info(`Sign Up Failed: User with email ${email} already exists`);
		throw httpErrors.badRequest(`User with email ${email} already exists`);
	}

	const hashed = await passwordManager.hash(password);

	const {id} = await kysely
		.insertInto("users")
		.values({
			email: email.toLowerCase(),
			password: hashed,
			createdAt: sql`NOW
      ()`,
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	const token = randomBytes(16).toString("hex");

	await Promise.all([
		emailManager.sendVerificationEmail(email, token, (err) => {
			log.error({err, email}, "Failed to send verification email");
		}),
		redis.setex(
			`${VerificationPrefix}${token}`,
			60 * config.application.verificationTokenTTLMinutes,
			id,
		),
	]);
}