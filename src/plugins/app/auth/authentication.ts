import fastify, {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
} from "fastify";
import fp from "fastify-plugin";
import { SessionPrefix } from "../../../const/redis.js";
import { User } from "../../../types/db/user.js";

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
			return reply.unauthorized("Unauthorized");
		}

		const unsigned = this.unsignCookie(session);
		if (!unsigned.valid) return reply.unauthorized("Unauthorized");

		const userId = (
			await instance.redis.getex(
				`${SessionPrefix}${unsigned.value}`,
				"EX",
				60 * instance.config.application.sessionTTLMinutes,
			)
		)
			?.split(SessionPrefix)
			.at(-1);

		if (!userId) return reply.unauthorized("Unauthorized");

		const user = await instance.kysely
			.selectFrom("users")
			.selectAll()
			.where("id", "=", userId)
			.executeTakeFirst();

		if (!user) return reply.unauthorized("Unauthorized");

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
