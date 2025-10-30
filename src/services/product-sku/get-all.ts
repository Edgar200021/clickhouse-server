import type {
	GetAllQuery,
	GetOneResult,
	ProductSkuService
} from "@/services/product-sku/product-sku.service.js";
import {UserRole} from "@/types/db/db.js";
import {WithPageCount} from "@/types/base.js";
import {sql} from "kysely";

export async function getAll<T extends UserRole>(
	this: ProductSkuService,
	query: GetAllQuery<T>,
	role: T,
): Promise<WithPageCount<GetOneResult<T>[], "productsSkus">> {

	const {kysely} = this.fastify

	const productsSkus = await this.buildAdminProductSku()
		.where((eb) => this.buildFilters(query, eb, role))
		.$if(!query.sort, eb => eb.orderBy("productSku.createdAt", "desc"))
		.$if(
			query.sort
				? query.sort === "priceASC" ||
				query.sort === "priceDESC" ||
				query.sort === "alphabetASC" ||
				query.sort === "alphabetDESC"
				: false,
			(eb) => {
				const isPrice = query.sort!.includes("price");
				const column = isPrice ? "productSku.price" : "product.name";
				const direction = query.sort!.endsWith("ASC") ? "asc" : "desc";


				return eb.orderBy(column, direction);
			},
		)
		.limit(query.limit)
		.offset(query.limit * query.page - query.limit)
		.execute();

	const {totalCount} = await kysely
		.selectFrom("productSku")
		.innerJoin("product", "product.id", "productSku.productId")
		.select(sql<number>`COUNT(*)::INTEGER`.as("totalCount"))
		.where((eb) => this.buildFilters(query, eb, role))
		.executeTakeFirstOrThrow();


	return {
		pageCount: Math.ceil(totalCount / query.limit),
		productsSkus: productsSkus.map((p) => (this.mapOneResult(p, role))),
	} as WithPageCount<GetOneResult<T>[], "productsSkus">;
}