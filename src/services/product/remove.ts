import {ProductParam} from "@/schemas/product/product-param.schema.js";
import {FastifyBaseLogger} from "fastify";
import {type ProductService} from "@/services/product/product.service.js";

export async function remove(this: ProductService, param: ProductParam, log: FastifyBaseLogger) {
	const {kysely, httpErrors} = this.fastify

	const product = await kysely
		.updateTable("product")
		.set("isDeleted", true)
		.where("id", "=", param.productId)
		.returning(["id"])
		.executeTakeFirst();

	if (!product) {
		log.info("Remove product failed: product not found");
		throw httpErrors.notFound("Product not found");
	}
}