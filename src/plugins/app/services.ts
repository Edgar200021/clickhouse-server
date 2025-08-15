import fp from "fastify-plugin";
import { createAuthService } from "../../services/auth.service.js";
import { createCategoryService } from "../../services/category.service.js";
import { createManufacturerService } from "../../services/manufacturer.service.js";
import { createUserService } from "../../services/user.service.js";

declare module "fastify" {
	export interface FastifyInstance {
		authService: ReturnType<typeof createAuthService>;
		categoryService: ReturnType<typeof createCategoryService>;
		manufacturerService: ReturnType<typeof createManufacturerService>;
		userService: ReturnType<typeof createUserService>;
	}
}

export default fp(
	async (instance) => {
		instance.decorate("authService", createAuthService(instance));
		instance.decorate("categoryService", createCategoryService(instance));
		instance.decorate(
			"manufacturerService",
			createManufacturerService(instance),
		);
		instance.decorate("userService", createUserService(instance));
	},
	{ dependencies: ["oauth"] },
);
