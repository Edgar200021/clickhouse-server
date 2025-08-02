import fp from "fastify-plugin";
import { createAuthService } from "../../services/auth.service.js";
import { createCategoryService } from "../../services/category.service.js";

declare module "fastify" {
	export interface FastifyInstance {
		authService: ReturnType<typeof createAuthService>;
		categoryService: ReturnType<typeof createCategoryService>;
	}
}

export default fp(
	async (instance) => {
		instance.decorate("authService", createAuthService(instance));
		instance.decorate("categoryService", createCategoryService(instance));
	},
	{ dependencies: ["oauth"] },
);
