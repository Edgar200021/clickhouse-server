import { createAuthService } from "../../services/auth.service.js";
import fp from "fastify-plugin";

declare module "fastify" {
	export interface FastifyInstance {
		authService: ReturnType<typeof createAuthService>;
	}
}

export default fp(
	async function (instance) {
		instance.decorate("authService", createAuthService(instance));
	},
	{ dependencies: ["oauth"] },
);
