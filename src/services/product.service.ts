import type { FastifyBaseLogger } from "fastify";
import type { FastifyInstance } from "fastify/types/instance.js";
import {
	type Expression,
	type ExpressionBuilder,
	type ExpressionWrapper,
	type SqlBool,
	sql,
} from "kysely";
import { ForeignKeyConstraintCode } from "../const/database.js";
import type { CreateProductRequest } from "../schemas/product/create-product.schema.js";
import type { GetProductsRequestQuery } from "../schemas/product/get-products.schema.js";
import type { ProductParam } from "../schemas/product/product-param.schema.js";
import type { UpdateProductRequest } from "../schemas/product/update-product.schema.js";
import type { WithCount } from "../types/base.js";
import type { DB } from "../types/db/db.js";
import { isDatabaseError } from "../types/db/error.js";
import type { Product } from "../types/db/product.js";

export function createProductService(instance: FastifyInstance) {
	const { kysely, httpErrors, fileUploaderManager } = instance;

	async function getAll(
		query: GetProductsRequestQuery,
	): Promise<WithCount<Product[], "products">> {
		const products = await kysely
			.selectFrom("product")
			.selectAll()
			.where((eb) => buildFilters(query, eb))
			.limit(query.limit)
			.offset(query.limit * query.page - query.limit)
			.execute();

		const { totalCount } = await kysely
			.selectFrom("product")
			.select(sql<number>`COUNT(*)::INTEGER`.as("totalCount"))
			.where((eb) => buildFilters(query, eb))
			.executeTakeFirstOrThrow();

		return {
			totalCount,
			products,
		};
	}

	async function create(
		data: CreateProductRequest,
		log: FastifyBaseLogger,
	): Promise<Product> {
		try {
			const uploadResult = data.assemblyInstruction
				? await fileUploaderManager.upload(
						Buffer.from(await data.assemblyInstruction.arrayBuffer()),
					)
				: null;

			const product = await kysely
				.insertInto("product")
				.values({
					name: data.name,
					description: data.description,
					shortDescription: data.shortDescription,
					materialsAndCare: data.materialsAndCare,
					categoryId: data.categoryId,
					manufacturerId: data.manufacturerId,
					...(uploadResult
						? {
								assemblyInstructionFileId: uploadResult.fileId,
								assemblyInstructionFileUrl: uploadResult.fileUrl,
							}
						: {}),
				})
				.returningAll()
				.executeTakeFirstOrThrow();

			return product;
		} catch (error) {
			if (isDatabaseError(error) && error.code === ForeignKeyConstraintCode) {
				log.info(
					`Create product failed: ${error.detail.includes("manufacturer_id") ? "Manufacturer doesn't exists" : "Category doesn't exists"}`,
				);
				throw httpErrors.notFound(
					error.detail.includes("manufacturer_id")
						? "Manufacturer doesn't exists"
						: "Category doesn't exists",
				);
			}

			throw error;
		}
	}

	async function update(
		data: UpdateProductRequest,
		param: ProductParam,
		log: FastifyBaseLogger,
	): Promise<Product> {
		try {
			const product = await kysely
				.selectFrom("product")
				.selectAll()
				.where("id", "=", param.productId)
				.executeTakeFirst();

			if (!product) {
				log.info("Update product failed: product not found");
				throw httpErrors.notFound("Product not found");
			}

			const uploadResult = data.assemblyInstruction
				? await fileUploaderManager.upload(data.assemblyInstruction)
				: null;

			if (uploadResult && product.assemblyInstructionFileId) {
				await fileUploaderManager.deleteFile(product.assemblyInstructionFileId);
			}

			const updateData: Partial<Product> = Object.entries(data)
				.filter(([key]) => key !== "assemblyInstruction")
				.reduce(
					(acc, [key, value]) => {
						const typedKey = key as keyof Product;

						if (product[typedKey] !== value) {
							acc[typedKey] = value;
						}

						return acc;
					},
					{} as Partial<Product>,
				);

			if (uploadResult) {
				updateData.assemblyInstructionFileId = uploadResult.fileId;
				updateData.assemblyInstructionFileUrl = uploadResult.fileUrl;
			}

			if (!Object.keys(updateData).length) return product;

			const updated = await kysely
				.updateTable("product")
				.set(updateData)
				.returningAll()
				.executeTakeFirstOrThrow();

			return updated;
		} catch (error) {
			if (isDatabaseError(error) && error.code === ForeignKeyConstraintCode) {
				log.info(
					`Create product failed: ${error.detail.includes("manufacturer_id") ? "Manufacturer doesn't exists" : "Category doesn't exists"}`,
				);
				throw httpErrors.notFound(
					error.detail.includes("manufacturer_id")
						? "Manufacturer doesn't exists"
						: "Category doesn't exists",
				);
			}

			throw error;
		}
	}

	async function remove(param: ProductParam, log: FastifyBaseLogger) {
		const product = await kysely
			.updateTable("product")
			.set("isDeleted", true)
			.where("id", "=", param.productId)
			.returning(["id"])
			.executeTakeFirst();

		if (!product) {
			log.info("delete product failed: product not found");
			throw httpErrors.notFound("Product not found");
		}
	}

	function buildFilters(
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
					eb("name", "ilike", `%${query.search}%`),
					eb("description", "ilike", `%${query.search}%`),
					eb("shortDescription", "ilike", `%${query.search}%`),
				]),
			);
		}

		return eb.and(ands);
	}

	return {
		getAll,
		create,
		update,
		remove,
	};
}
