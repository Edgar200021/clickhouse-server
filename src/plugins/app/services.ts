import fp from "fastify-plugin";
import { createAuthService } from "../../services/auth.service.js";
import { createCartService } from "../../services/cart.service.js";
import { createCategoryService } from "../../services/category.service.js";
import { createCronService } from "../../services/cron.service.js";
import { createManufacturerService } from "../../services/manufacturer.service.js";
import { createOrderService } from "../../services/order.service.js";
import { createPriceService } from "../../services/price.service.js";
import { createProductService } from "../../services/product.service.js";
import { createProductSkuService } from "../../services/product-sku.service.js";
import { createPromocodeService } from "../../services/promocode.service.js";
import { createUserService } from "../../services/user.service.js";

declare module "fastify" {
	export interface FastifyInstance {
		authService: ReturnType<typeof createAuthService>;
		categoryService: ReturnType<typeof createCategoryService>;
		manufacturerService: ReturnType<typeof createManufacturerService>;
		userService: ReturnType<typeof createUserService>;
		productService: ReturnType<typeof createProductService>;
		productSkuService: ReturnType<typeof createProductSkuService>;
		cartService: ReturnType<typeof createCartService>;
		promocodeService: ReturnType<typeof createPromocodeService>;
		priceService: ReturnType<typeof createPriceService>;
		orderService: ReturnType<typeof createOrderService>;
		cronService: ReturnType<typeof createCronService>;
	}
}

export default fp(
	async (instance) => {
		instance.decorate("priceService", createPriceService(instance));
		instance.decorate("productService", createProductService(instance));
		instance.decorate("productSkuService", createProductSkuService(instance));
		instance.decorate("promocodeService", createPromocodeService(instance));
		instance.decorate("cartService", createCartService(instance));
		instance.decorate("authService", createAuthService(instance));
		instance.decorate("categoryService", createCategoryService(instance));
		instance.decorate(
			"manufacturerService",
			createManufacturerService(instance),
		);
		instance.decorate("userService", createUserService(instance));
		instance.decorate("orderService", createOrderService(instance));
		instance.decorate("cronService", createCronService(instance));
	},
	{ dependencies: ["oauth"] },
);
