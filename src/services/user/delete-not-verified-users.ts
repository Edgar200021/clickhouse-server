import {sql} from "kysely";
import {type UserService} from "@/services/user/user.service.js";

export async function deleteNotVerifiedUsers(this: UserService) {
	const {config, kysely} = this.fastify

	// language=SQL format=false
	await sql`
      DELETE
      FROM users
      WHERE is_verified = false
        AND created_at < NOW() - make_interval(mins => ${config.application.verificationTokenTTLMinutes})
	`.execute(kysely);
}