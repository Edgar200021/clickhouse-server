import {AuthService} from "./auth.service.js";
import {OAauthSessionPrefix} from "@/const/cookie.js";
import {SessionPrefix} from "@/const/redis.js";
import {FastifyRequest} from "fastify/types/request.js";

export async function logout(this: AuthService, req: FastifyRequest) {
	const {config, httpErrors, redis} = this.fastify
	const session = req.cookies[config.application.sessionCookieName];

	if (!session) {
		req.log.info("Logout failed: session not found");
		throw httpErrors.notFound("Session not found ");
	}

	const unsigned = req.unsignCookie(session);
	if (!unsigned.valid) {
		req.log.info("Logout failed: session not valid");
		throw httpErrors.badRequest("Session not valid");
	}

	const [_, value] = unsigned.value.split(OAauthSessionPrefix);

	await redis.del(`${SessionPrefix}${value ?? unsigned.value}`);
}