import {Combined} from "@/types/base.js";
import {ProductSkuParam} from "@/schemas/product-sku/product-sku-param.schema.js";
import {ProductSkuImages} from "@/types/db/product.js";
import {FastifyBaseLogger} from "fastify";
import {type ProductSkuService} from "@/services/product-sku/product-sku.service.js";
import {sql} from "kysely";

export async function deleteImage(
	this: ProductSkuService,
	param: Combined<ProductSkuParam, ProductSkuImages["id"], "imageId">,
	log: FastifyBaseLogger,
) {
	const {kysely, httpErrors, fileUploaderManager} = this.fastify

	try {
		const countResult = await kysely
			.selectFrom("productSkuImages")
			.select(sql<number>`COUNT(*)::INTEGER`.as("count"))
			.where("productSkuId", "=", param.productSkuId)
			.groupBy("productSkuId")
			.executeTakeFirstOrThrow();

		if (countResult.count === 1) {
			log.info(
				"Delete image failed: product SKU must have at least one image",
			);
			throw httpErrors.badRequest("Product must have at least one image");
		}

		const image = await kysely
			.deleteFrom("productSkuImages")
			.where("productSkuId", "=", param.productSkuId)
			.where("id", "=", param.imageId)
			.returning(["id", "imageId"])
			.executeTakeFirst();

		if (!image) {
			log.info("Delete product sku image failed: image not found");
			throw httpErrors.notFound("Image not found");
		}

		await fileUploaderManager.deleteFile(image.imageId);
	} catch (err) {
		if (
			err instanceof Error &&
			err.message.toLowerCase().includes("no result")
		) {
			log.info("Remove product sku image failed: product sku not found");
			throw httpErrors.notFound("Product Sku not found");
		}

		throw err;
	}
}