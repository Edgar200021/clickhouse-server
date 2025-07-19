import type { FastifyBaseLogger } from "fastify";
import type { FastifyInstance } from "fastify/types/instance.js";
import type { User } from "../types/db/user.js";

export function assertValidUser(
	user: Pick<User, "id" | "isBanned" | "isVerified"> | undefined,
	log: FastifyBaseLogger,
	httpErrors: FastifyInstance["httpErrors"],
	{
		prefix,
		checkConditions,
	}: {
		prefix?: string;
		checkConditions: ("undefined" | "banned" | "notVerified")[];
	},
) {
	const context = prefix ? `${prefix} ` : "";

	if (checkConditions.includes("undefined") && !user) {
		log.info(`${context}User not found`);
		throw httpErrors.notFound("User not found");
	}

	if (checkConditions.includes("banned") && user?.isBanned) {
		log.info({ userID: user.id }, `${context}User is banned`);
		throw httpErrors.badRequest("User is banned");
	}

	if (checkConditions.includes("notVerified") && !user?.isVerified) {
		log.info({ userID: user?.id }, `${context}User is not verified`);
		throw httpErrors.badRequest("User is not verified");
	}
}
