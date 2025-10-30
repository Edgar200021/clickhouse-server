import type {FastifyBaseLogger} from "fastify";
import type {SignInRequest} from "@/schemas/auth/sign-in.schema.js";
import {assertValidUser} from "@/utils/user.utils.js";
import {AuthService} from "./auth.service.js";

export async function signIn(this: AuthService, data: SignInRequest, log: FastifyBaseLogger) {
	const {kysely, passwordManager, httpErrors} = this.fastify

	const user = await kysely
		.selectFrom("users")
		.selectAll()
		.where("email", "=", data.email.toLowerCase())
		.executeTakeFirst();

	if (
		!user ||
		!user.password ||
		!(await passwordManager.compare(data.password, user.password))
	) {
		log.info("Invalid credentials");
		throw httpErrors.badRequest("Invalid credentials");
	}

	assertValidUser(user, log, httpErrors, {
		prefix: "Sign in failed:",
		checkConditions: ["undefined", "banned", "notVerified"],
	});

	const uuid = await this.generateSession(user, "regular");

	return {uuid, user};
}