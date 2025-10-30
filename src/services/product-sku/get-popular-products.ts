import {type GetOneResult, ProductSkuService} from "@/services/product-sku/product-sku.service.js";
import {OrderStatus, UserRole} from "@/types/db/db.js";
import {PopularProductsLimit} from "@/const/const.js";
import {PopularProductsKey} from "@/const/redis.js";

export async function getPopularProducts<T extends UserRole>(this: ProductSkuService, role: T): Promise<GetOneResult<T>[]> {
	const {kysely, redis} = this.fastify

	const cachedProducts = await redis.get(PopularProductsKey)
	if (cachedProducts) {
		return JSON.parse(cachedProducts).map(p => (this.mapOneResult(p, role)))
	}

	const topIds = await kysely.selectFrom("orderItem")
		.innerJoin("order", "order.id", "orderItem.orderId")
		.innerJoin("productSku", "productSku.id", "orderItem.productSkuId")
		.innerJoin("product", "product.id", "productSku.productId")
		.select(["productSku.id"])
		.select(eb => eb.fn.sum("orderItem.quantity").as("orderItemQuantity"))
		.where("product.isDeleted", "=", false)
		.where("order.status", "in", [OrderStatus.Delivered, OrderStatus.Paid, OrderStatus.Shipped])
		.groupBy("productSku.id")
		.orderBy("orderItemQuantity", "desc")
		.limit(8)
		.execute()

	if (topIds.length < PopularProductsLimit) {
		const fallbackIds = await kysely.selectFrom("productSku")
			.innerJoin("product", "product.id", "productSku.productId")
			.select("productSku.id")
			.where("product.isDeleted", "=", false)
			.distinctOn("product.categoryId")
			.limit(PopularProductsLimit - topIds.length)
			.execute()

		topIds.push(...fallbackIds.map(({id}) => ({id, orderItemQuantity: 0})))
	}

	const popular = await this.buildAdminProductSku()
		.where("productSku.id", "in", topIds.map(p => p.id))
		.execute()

	await redis.setex(PopularProductsKey, 30 * 60, JSON.stringify(popular))

	return popular.map(p => (this.mapOneResult(p, role)))
}