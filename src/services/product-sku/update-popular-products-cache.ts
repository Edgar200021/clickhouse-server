import {ProductSkuService} from "@/services/product-sku/product-sku.service.js";
import {PopularProductsKey} from "@/const/redis.js";
import {UserRole} from "@/types/db/db.js";

export async function updatePopularProductsCache(this: ProductSkuService) {
	const {fastify: {redis}, getPopularProducts} = this

	await redis.del(PopularProductsKey)

	await this.getPopularProducts(UserRole.Admin)
}