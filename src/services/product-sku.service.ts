import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import type { FastifyInstance } from "fastify/types/instance.js";
import {
	type Expression,
	type ExpressionBuilder,
	type ExpressionWrapper,
	type SqlBool,
	sql,
} from "kysely";
import { DuplicateCode, ForeignKeyConstraintCode } from "../const/database.js";
import type { CreateProductSkuRequest } from "../schemas/product-sku/create-product-sku.schema.js";
import type { GetProductsSkusRequestQuery } from "../schemas/product-sku/get-products-skus.schema.js";
import type { ProductSkuAttributes } from "../schemas/product-sku/product-sku.schema.js";
import type { ProductSkuParam } from "../schemas/product-sku/product-sku-param.schema.js";
import type { Combined, WithPageCount } from "../types/base.js";
import { type DB, UserRole } from "../types/db/db.js";
import { isDatabaseError } from "../types/db/error.js";
import type {
	Product,
	ProductSku,
	ProductSkuImages,
	ProductSkuPackage,
} from "../types/db/product.js";

export function createProductSkuService(instance: FastifyInstance) {
	const { kysely, httpErrors, fileUploaderManager } = instance;

	async function getAll(query: GetProductsSkusRequestQuery): Promise<
		WithPageCount<
			Combined<
				Omit<ProductSku, "productId" | "attributes"> & {
					attributes: ProductSkuAttributes;
					images: Pick<ProductSkuImages, "imageId" | "imageUrl">[];
					packages: Omit<ProductSkuPackage, "productSkuId">[];
				},
				Product,
				"product"
			>[],
			"productsSkus"
		>
	> {
		const productsSkus = await buildAdminProductSku()
			.where((eb) => buildFilters(query, eb))
			.orderBy("productSku.createdAt", "desc")
			.limit(query.limit)
			.offset(query.limit * query.page - query.limit)
			.execute();

		const { totalCount } = await kysely
			.selectFrom("productSku")
			.innerJoin("product", "product.id", "productSku.productId")
			.select(sql<number>`COUNT(*)::INTEGER`.as("totalCount"))
			.where((eb) => buildFilters(query, eb))
			.executeTakeFirstOrThrow();

		return {
			pageCount: Math.ceil(totalCount / query.limit),
			productsSkus: productsSkus.map((p) => ({
				id: p.id,
				createdAt: p.createdAt,
				updatedAt: p.updatedAt,
				currency: p.currency,
				price: p.price,
				salePrice: p.salePrice,
				quantity: p.quantity,
				sku: p.sku,
				attributes: p.attrs,
				images: p.images,
				packages: p.packages,
				product: {
					id: p.pid,
					createdAt: p.pcr,
					updatedAt: p.pup,
					name: p.name,
					description: p.description,
					shortDescription: p.shortDescription,
					materialsAndCare: p.materialsAndCare,
					assemblyInstructionFileId: p.assemblyInstructionFileId,
					assemblyInstructionFileUrl: p.assemblyInstructionFileUrl,
					isDeleted: p.isDeleted,
					categoryId: p.categoryId,
					manufacturerId: p.manufacturerId,
				},
			})),
		};
	}

	async function getOne(
		param: ProductSkuParam,
		type: UserRole.Admin,
		log: FastifyBaseLogger,
	): Promise<
		Combined<
			Omit<ProductSku, "productId" | "attributes"> & {
				attributes: ProductSkuAttributes;
				images: Pick<ProductSkuImages, "imageId" | "imageUrl">[];
				packages: Omit<ProductSkuPackage, "productSkuId">[];
			},
			Product,
			"product"
		>
	>;
	async function getOne(
		param: ProductSkuParam,
		type: UserRole.Regular,
		log: FastifyBaseLogger,
	): Promise<null>;
	async function getOne(
		param: ProductSkuParam,
		type: UserRole,
		log: FastifyBaseLogger,
	) {
		if (type === UserRole.Admin) {
			const productSku = await buildAdminProductSku()
				.where("productSku.id", "=", param.productSkuId)
				.executeTakeFirstOrThrow();

			return {
				id: productSku.id,
				createdAt: productSku.createdAt,
				updatedAt: productSku.updatedAt,
				currency: productSku.currency,
				price: productSku.price,
				salePrice: productSku.salePrice,
				quantity: productSku.quantity,
				sku: productSku.sku,
				attributes: productSku.attrs,
				images: productSku.images,
				packages: productSku.packages,
				product: {
					id: productSku.pid,
					createdAt: productSku.pcr,
					updatedAt: productSku.pup,
					name: productSku.name,
					description: productSku.description,
					shortDescription: productSku.shortDescription,
					materialsAndCare: productSku.materialsAndCare,
					assemblyInstructionFileId: productSku.assemblyInstructionFileId,
					assemblyInstructionFileUrl: productSku.assemblyInstructionFileUrl,
					isDeleted: productSku.isDeleted,
					categoryId: productSku.categoryId,
					manufacturerId: productSku.manufacturerId,
				},
			};
		}

		return null;
	}

	async function create(
		body: CreateProductSkuRequest,
		log: FastifyBaseLogger,
	): Promise<
		Omit<ProductSku, "attributes"> & {
			attributes: ProductSkuAttributes;
			images: Pick<ProductSkuImages, "imageId" | "imageUrl">[];
			packages: Omit<ProductSkuPackage, "productSkuId">[];
		}
	> {
		try {
			const { attributeKeys, attributeValues } = buildAttributes(
				body as ProductSkuAttributes,
			);

			const product = await kysely.transaction().execute(async (trx) => {
				const product = await trx
					.insertInto("productSku")
					.values({
						productId: body.productId,
						sku: randomUUID(),
						price: body.price,
						salePrice: body.salePrice,
						quantity: body.quantity,
						attributes: sql`
      hstore(
        array[${sql.join(attributeKeys)}],
        array[${sql.join(attributeValues)}]
      )
    `,
					})
					.returning([
						"id",
						"productId",
						"sku",
						"currency",
						"price",
						"salePrice",
						"quantity",
						sql<ProductSkuAttributes>`hstore_to_json(product_sku.attributes)`.as(
							"attributes",
						),
						"createdAt",
						"updatedAt",
					])
					.executeTakeFirstOrThrow();

				const uploadRes = await Promise.all(
					body.images.map(
						async (file) => await fileUploaderManager.upload(file),
					),
				);

				const [_, packages] = await Promise.all([
					trx
						.insertInto("productSkuImages")
						.values(
							uploadRes.map((res) => ({
								imageId: res.fileId,
								imageUrl: res.fileUrl,
								productSkuId: product.id,
							})),
						)
						.execute(),
					...(body.packages
						? [
								trx
									.insertInto("productSkuPackage")
									.values(
										body.packages.map((pkg) => ({
											productSkuId: product.id,
											...pkg,
										})),
									)
									.returningAll()
									.execute(),
							]
						: []),
				]);

				return {
					...product,
					images: uploadRes.map((res) => ({
						imageId: res.fileId,
						imageUrl: res.fileUrl,
					})),
					packages: (packages ?? []).map((p) => ({
						id: p.id,
						createdAt: p.createdAt,
						updatedAt: p.updatedAt,
						quantity: p.quantity,
						width: p.width,
						height: p.height,
						length: p.length,
						weight: p.weight,
					})),
				};
			});

			return product;
		} catch (err) {
			if (isDatabaseError(err)) {
				let logMsg = "";
				let clientMsg = "";

				switch (err.code) {
					case DuplicateCode:
						if (err.table === "product_sku_package") {
							logMsg = "Duplicate packages";
							clientMsg = "Duplicate packages";
						} else {
							logMsg = "Create product SKU failed: duplicate attributes";
							clientMsg = "Product with these characteristics already exists";
						}
						break;

					case ForeignKeyConstraintCode:
						logMsg = "Product doesn't exist";
						clientMsg = "Product doesn't exist";
						break;
				}

				if (logMsg) {
					log.info({ body }, logMsg);
					throw err.code === ForeignKeyConstraintCode
						? httpErrors.notFound(clientMsg)
						: httpErrors.badRequest(clientMsg);
				}
			}

			throw err;
		}
	}

	function buildAdminProductSku() {
		const productSku = kysely
			.selectFrom("productSku")
			.innerJoin("product", "product.id", "productSku.productId")
			.select([
				"product.id as pid",
				"product.createdAt as pcr",
				"product.updatedAt as pup",
				"product.name",
				"product.description",
				"product.shortDescription",
				"product.materialsAndCare",
				"product.isDeleted",
				"product.assemblyInstructionFileId",
				"product.assemblyInstructionFileUrl",
				"product.categoryId",
				"product.manufacturerId",
			])
			.select(
				sql<ProductSkuAttributes>`hstore_to_json(product_sku.attributes)`.as(
					"attrs",
				),
			)
			.select((eb) =>
				eb
					.selectFrom("productSkuImages")
					.select(
						sql<Pick<ProductSkuImages, "imageId" | "imageUrl">[]>`
			COALESCE(
			  json_agg(
			    json_build_object(
			      'imageId', product_sku_images.image_id,
			      'imageUrl', product_sku_images.image_url
			    )
			  ),
			  '[]'::json
			)
			   `.as("images"),
					)
					.whereRef("productSkuImages.productSkuId", "=", "productSku.id")
					.as("images"),
			)
			.select((eb) =>
				eb
					.selectFrom("productSkuPackage")
					.select(
						sql<Omit<ProductSkuPackage, "productSkuId">[]>`
			     COALESCE(
			       json_agg(
			         json_build_object(
			           'id', product_sku_package.id,
			           'createdAt', product_sku_package.created_at,
			           'updatedAt', product_sku_package.updated_at,
			           'length', product_sku_package.length,
			           'quantity', product_sku_package.quantity,
			           'width', product_sku_package.width,
			           'height', product_sku_package.height,
			           'weight', product_sku_package.weight
			         )
			       ),
			       '[]'::json
			     )
			   `.as("packages"),
					)
					.whereRef("productSkuPackage.productSkuId", "=", "productSku.id")
					.as("packages"),
			)
			.selectAll(["productSku"]);

		return productSku;
	}

	function buildFilters(
		query: GetProductsSkusRequestQuery,
		eb: ExpressionBuilder<DB, "product" | "productSku">,
	): ExpressionWrapper<DB, "productSku" | "product", SqlBool> {
		const ands: Expression<SqlBool>[] = [];

		if (query.isDeleted !== undefined) {
			ands.push(eb("product.isDeleted", "=", query.isDeleted));
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

		if (query.minPrice) {
			ands.push(eb("productSku.price", ">=", query.minPrice));
		}

		if (query.maxPrice) {
			ands.push(eb("productSku.price", "<=", query.maxPrice));
		}

		if (query.minSalePrice) {
			ands.push(eb("productSku.salePrice", ">=", query.minSalePrice));
		}

		if (query.maxSalePrice) {
			ands.push(eb("productSku.salePrice", "<=", query.maxSalePrice));
		}

		if (query.sku) {
			ands.push(eb("productSku.sku", "=", query.sku));
		}

		return eb.and(ands);
	}

	function buildAttributes(attr: ProductSkuAttributes) {
		const attributeKeys = ["width", "height", "color", "length"];
		const attributeValues = [attr.width, attr.height, attr.color, attr.length];

		if (attr.weight) {
			attributeKeys.push("length");
			attributeValues.push(attr.weight);
		}

		return {
			attributeKeys,
			attributeValues,
		};
	}

	return { getAll, create };
}
