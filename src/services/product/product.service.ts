import fp from "fastify-plugin"
import {FastifyInstance} from "fastify";
import type {GetProductsRequestQuery} from "@/schemas/product/get-products.schema.js";
import type {Expression, ExpressionBuilder, ExpressionWrapper, SqlBool} from "kysely";
import type {DB} from "@/types/db/db.js";
import {getById} from "@/services/product/get-by-id.js";
import {getAll} from "@/services/product/get-all.js";
import {create} from "@/services/product/create.js";
import {update} from "@/services/product/update.js";
import {remove} from "@/services/product/remove.js";
import {removeAssemblyInstruction} from "@/services/product/remove-assembly-instruction.js";


declare module "fastify" {
	export interface FastifyInstance {
		productService: ProductService
	}
}

export class ProductService {
	getAll = getAll
	getById = getById
	create = create
	update = update
	remove = remove
	removeAssemblyInstruction = removeAssemblyInstruction

	constructor(readonly fastify: FastifyInstance) {
		this.buildFilters = this.buildFilters.bind(this)

	}


	buildFilters(
		query: GetProductsRequestQuery,
		eb: ExpressionBuilder<DB, "product">,
	): ExpressionWrapper<DB, "product", SqlBool> {
		const ands: Expression<SqlBool>[] = [];

		if (query.isDeleted !== undefined) {
			ands.push(eb("isDeleted", "=", query.isDeleted));
		}

		if (query.search) {
			ands.push(
				eb.or([
					eb("product.name", "ilike", `%${query.search}%`),
					eb("product.description", "ilike", `%${query.search}%`),
					eb("product.shortDescription", "ilike", `%${query.search}%`),
				]),
			);
		}

		return eb.and(ands);
	}
}


export default fp(async (fastify: FastifyInstance) => {
	fastify.decorate("productService", new ProductService(fastify))
}, {
	name: "productService",
	dependencies: ["redis", "fileUploaderManager"]
})