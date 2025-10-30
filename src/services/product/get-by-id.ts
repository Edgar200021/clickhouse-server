import {ProductParam} from "@/schemas/product/product-param.schema.js";
import {FastifyBaseLogger} from "fastify";
import {Product} from "@/types/db/product.js";
import {type ProductService} from "@/services/product/product.service.js";

export async function getById(
	this: ProductService,
	param: ProductParam,
	log: FastifyBaseLogger,
): Promise<Product> {
	const {kysely, httpErrors} = this.fastify
	const product = await kysely
		.selectFrom("product")
		.selectAll()
		.where("id", "=", param.productId)
		.executeTakeFirst();

	if (!product) {
		log.info("Get product failed: product not found");
		throw httpErrors.notFound("Product not found");
	}

	return product;
}