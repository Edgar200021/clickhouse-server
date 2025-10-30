import {type ProductSkuService} from "@/services/product-sku/product-sku.service.js";
import {Combined} from "@/types/base.js";
import {ProductSkuParam} from "@/schemas/product-sku/product-sku-param.schema.js";
import {ProductSkuPackage} from "@/types/db/product.js";
import {FastifyBaseLogger} from "fastify";

export async function deletePackage(
	this: ProductSkuService,
	param: Combined<ProductSkuParam, ProductSkuPackage["id"], "packageId">,
	log: FastifyBaseLogger,
) {
	const {kysely, httpErrors} = this.fastify

	const pkg = await kysely
		.deleteFrom("productSkuPackage")
		.where("productSkuId", "=", param.productSkuId)
		.where("id", "=", param.packageId)
		.returning("id")
		.executeTakeFirst();

	if (!pkg) {
		log.info("Delete product sku package failed: package not found");
		throw httpErrors.notFound("Package not found");
	}
}