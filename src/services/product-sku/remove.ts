import type {ProductSkuParam} from "@/schemas/product-sku/product-sku-param.schema.js";
import type {FastifyBaseLogger} from "fastify";
import type {ProductSkuService} from "@/services/product-sku/product-sku.service.js";

export async function remove(this: ProductSkuService, param: ProductSkuParam, log: FastifyBaseLogger) {
	const {kysely, httpErrors} = this.fastify

	const productSku = await kysely
		.deleteFrom("productSku")
		.where("id", "=", param.productSkuId)
		.returning(["id"])
		.executeTakeFirst();

	if (!productSku) {
		log.info("Delete product sku failed: product sku not found");
		throw httpErrors.notFound("Product sku not found");
	}
}