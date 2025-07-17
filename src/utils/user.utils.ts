import type { FastifyBaseLogger } from "fastify";
import type { FastifyInstance } from "fastify/types/instance.js";
import type { User } from "../types/db/user.js";

export function assertValidUser(
	user: Pick<User, "id" | "isBanned" | "isVerified"> | undefined,
	log: FastifyBaseLogger,
	httpErrors: FastifyInstance["httpErrors"],
	prefix?: string,
) {
	const context = prefix ? `${prefix} ` : "";

	if (!user) {
		log.info(`${context}User not found`);
		throw httpErrors.notFound("User not found");
	}

	if (user.isBanned) {
		log.info({ userID: user.id }, `${context}User is banned`);
		throw httpErrors.badRequest("User is banned");
	}

	if (user.isVerified) {
		log.info({ userID: user.id }, `${context}User already verified`);
		throw httpErrors.badRequest("User already verified");
	}
}
