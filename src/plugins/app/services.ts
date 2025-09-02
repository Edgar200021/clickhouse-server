import fp from "fastify-plugin";
import { createAuthService } from "../../services/auth.service.js";
import { createCategoryService } from "../../services/category.service.js";
import { createManufacturerService } from "../../services/manufacturer.service.js";
import { createProductService } from "../../services/product.service.js";
import { createProductSkuService } from "../../services/product-sku.service.js";
import { createUserService } from "../../services/user.service.js";

declare module "fastify" {
	export interface FastifyInstance {
		authService: ReturnType<typeof createAuthService>;
		categoryService: ReturnType<typeof createCategoryService>;
		manufacturerService: ReturnType<typeof createManufacturerService>;
		userService: ReturnType<typeof createUserService>;
		productService: ReturnType<typeof createProductService>;
		productSkuService: ReturnType<typeof createProductSkuService>;
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
		instance.decorate("productService", createProductService(instance));
		instance.decorate("productSkuService", createProductSkuService(instance));
	},
	{ dependencies: ["oauth"] },
);
