import type {GetOneResult, ProductSkuService} from "@/services/product-sku/product-sku.service.js";
import {UserRole} from "@/types/db/db.js";
import {ProductSkuParam} from "@/schemas/product-sku/product-sku-param.schema.js";
import {FastifyBaseLogger} from "fastify";

export async function getOne<T extends UserRole>(
	this: ProductSkuService,
	param: ProductSkuParam,
	role: T,
	log: FastifyBaseLogger,
): Promise<GetOneResult<T>> {
	const {httpErrors} = this.fastify

	const productSku = await this.buildAdminProductSku()
		.where("productSku.id", "=", param.productSkuId)
		.$if(role === UserRole.Regular, (eb) =>
			eb.where("product.isDeleted", "=", false),
		)
		.executeTakeFirst();

	if (!productSku) {
		log.info("Get product sku failed: product sku not found");
		throw httpErrors.notFound("Product Sku not found");
	}

	return this.mapOneResult(productSku, role)
}