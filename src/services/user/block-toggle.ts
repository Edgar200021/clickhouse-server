import {type UserService} from "@/services/user/user.service.js";
import {BlockToggleRequest} from "@/schemas/user/block-toggle.schema.js";
import {UserParam} from "@/schemas/user/user-param.schema.js";
import {FastifyBaseLogger} from "fastify";

export async function blockToggle(
	this: UserService,
	data: BlockToggleRequest,
	param: UserParam,
	log: FastifyBaseLogger,
) {
	const {kysely, httpErrors} = this.fastify

	const user = await kysely
		.selectFrom("users")
		.select(["isBanned"])
		.where("id", "=", param.userId)
		.executeTakeFirst();

	if (!user) {
		log.info("Block toggle failed: user doesn't exist");
		throw httpErrors.notFound("User doesn't exist");
	}

	if (user.isBanned === (data.type === "lock")) {
		log.info(
			{userId: param.userId, attemptedAction: data.type},
			`Block toggle failed: user is already ${data.type === "lock" ? "banned" : "unbanned"}`,
		);
		throw httpErrors.badRequest(
			`User is already ${data.type === "lock" ? "banned" : "unbanned"}`,
		);
	}

	await kysely
		.updateTable("users")
		.where("id", "=", param.userId)
		.set({
			isBanned: data.type === "lock",
		})
		.execute();
}