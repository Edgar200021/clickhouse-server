import fastify, {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
} from "fastify";
import fp from "fastify-plugin";
import { SessionPrefix } from "../../../const/redis.js";
import { User } from "../../../types/db/user.js";
import { assertValidUser } from "../../../utils/user.utils.js";
import { OAauthSessionPrefix } from "../../../const/session.js";

declare module "fastify" {
	export interface FastifyRequest {
		authenticate: ReturnType<typeof authenticate>;
		user: User | null;
	}
}

function authenticate(instance: FastifyInstance) {
	return async function (this: FastifyRequest, reply: FastifyReply) {
		const session = this.cookies[instance.config.application.sessionName];

		if (!session) {
			this.log.info("Authentication failed: session not found");
			return reply.unauthorized("Unauthorized");
		}

		const unsigned = this.unsignCookie(session);
		if (!unsigned.valid) {
			this.log.info("Authentication failed: session not valid");
			return reply.unauthorized("Unauthorized");
		}

		const [oauthPrefix, value] = unsigned.value.split(OAauthSessionPrefix);
		const isOauth = oauthPrefix === "" && value;

		const userId = (
			!isOauth
				? await instance.redis.get(`${SessionPrefix}${unsigned.value}`)
				: await instance.redis.getex(
						`${SessionPrefix}${value}`,
						"EX",
						60 * instance.config.application.OAuth2sessionTTLMinutes,
					)
		)
			?.split(SessionPrefix)
			.at(-1);

		if (!userId) {
			this.log.info(
				"Authentication failed: session in db not found or expired",
			);
			return reply.unauthorized("Unauthorized");
		}

		const user = await instance.kysely
			.selectFrom("users")
			.selectAll()
			.where("id", "=", userId)
			.executeTakeFirst();

		if (!user) {
			this.log.info("Authentication failed: user not found");
			return reply.unauthorized("Unauthorized");
		}

		assertValidUser(user, this.log, instance.httpErrors, {
			prefix: "Authentication failed:",
			checkConditions: ["banned", "notVerified"],
		});

		if (isOauth) {
			reply.setCookie(instance.config.application.sessionName, unsigned.value, {
				maxAge: instance.config.application.OAuth2sessionTTLMinutes * 60,
			});
		}

		this.user = user;
	};
}

export default fp(
	async function (fastify) {
		fastify.decorateRequest("user", null);
		fastify.addHook("onRequest", async (req) => {
			req.user = null;
		});
		fastify.decorateRequest("authenticate", authenticate(fastify));
	},
	{
		name: "authentication",
		dependencies: ["kysely"],
	},
);
