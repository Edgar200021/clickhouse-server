import type {GetProductsRequestQuery} from "@/schemas/product/get-products.schema.js";
import type {WithPageCount} from "@/types/base.js";
import type {Product} from "@/types/db/product.js";
import {type ProductService} from "@/services/product/product.service.js";
import {sql} from "kysely";

export async function getAll(
	this: ProductService,
	query: GetProductsRequestQuery,
): Promise<WithPageCount<Product[], "products">> {
	const {fastify: {kysely}, buildFilters} = this
	const products = await kysely
		.selectFrom("product")
		.selectAll()
		.where((eb) => this.buildFilters(query, eb))
		.limit(query.limit)
		.offset(query.limit * query.page - query.limit)
		.execute();

	const {totalCount} = await kysely
		.selectFrom("product")
		.select(sql<number>`COUNT(*)::INTEGER`.as("totalCount"))
		.where((eb) => buildFilters(query, eb))
		.executeTakeFirstOrThrow();

	return {
		pageCount: Math.ceil(totalCount / query.limit),
		products,
	};
}