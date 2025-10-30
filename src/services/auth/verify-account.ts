import type {VerifyAccountRequest} from "@/schemas/auth/verify-account.schema.js";
import type {FastifyBaseLogger} from "fastify";
import {VerificationPrefix} from "@/const/redis.js";
import {assertValidUser} from "@/utils/user.utils.js";
import {sql} from "kysely";
import {AuthService} from "./auth.service.js";


export async function verifyAccount(
	this: AuthService,
	data: VerifyAccountRequest,
	log: FastifyBaseLogger,
) {
	const {redis, kysely, httpErrors, cartService} = this.fastify

	const {token} = data;

	const userID = await redis.getdel(`${VerificationPrefix}${token}`);

	if (!userID) {
		log.info({token}, "Verification failed: invalid or expired token");
		throw httpErrors.notFound("Invalid or expired token");
	}

	const user = await kysely
		.selectFrom("users")
		.selectAll()
		.where("id", "=", userID)
		.executeTakeFirst();

	assertValidUser(user, log, httpErrors, {
		prefix: "Verification failed:",
		checkConditions: ["undefined", "banned"],
	});

	if (user?.isVerified) {
		log.info(
			{userID: user?.id},
			`Verification failed:User is already verified`,
		);
		throw httpErrors.badRequest("User is already verified");
	}

	await kysely.transaction().execute(async (trx) => {
		await trx
			.updateTable("users")
			.set({
				isVerified: true,
				updatedAt: sql`NOW
        ()`,
			})
			.where("id", "=", userID)
			.execute();

		await cartService.createIfNotExists(user!, trx);
	});
}