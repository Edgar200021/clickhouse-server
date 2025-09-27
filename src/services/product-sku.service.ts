import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import {
	type Expression,
	type ExpressionBuilder,
	type ExpressionWrapper,
	type SqlBool,
	sql,
} from "kysely";
import { DuplicateCode, ForeignKeyConstraintCode } from "../const/database.js";
import {
	ProductSkuImagesMaxLength,
	ProductSkuPackagesMaxLength,
} from "../const/zod.js";
import type { CreateProductSkuRequest } from "../schemas/product-sku/create-product-sku.schema.js";
import type { GetProductsSkusRequestQuery } from "../schemas/product-sku/get-products-skus.schema.js";
import type { GetProductsSkusAdminRequestQuery } from "../schemas/product-sku/get-products-skus-admin.schema.js";
import type { ProductSkuAttributes } from "../schemas/product-sku/product-sku.schema.js";
import type { ProductSkuParam } from "../schemas/product-sku/product-sku-param.schema.js";
import type { UpdateProductSkuRequest } from "../schemas/product-sku/update-product-sku.schema.js";
import type { Combined, WithPageCount } from "../types/base.js";
import type { FileUploadResponse } from "../types/cloudinary.js";
import { type DB, UserRole } from "../types/db/db.js";
import { isDatabaseError } from "../types/db/error.js";
import type {
	Product,
	ProductSku,
	ProductSkuImages,
	ProductSkuPackage,
	UpdateProductSku,
} from "../types/db/product.js";

type GetOneResult<T extends UserRole> = T extends UserRole.Admin
	? Combined<
			Omit<ProductSku, "productId" | "attributes"> & {
				attributes: ProductSkuAttributes;
				images: Pick<ProductSkuImages, "id" | "imageId" | "imageUrl">[];
				packages: Omit<ProductSkuPackage, "productSkuId">[];
			},
			Product,
			"product"
		>
	: Combined<
			Omit<
				ProductSku,
				"productId" | "attributes" | "createdAt" | "updatedAt"
			> & {
				attributes: ProductSkuAttributes;
				images: Pick<ProductSkuImages, "imageId" | "imageUrl">[];
				packages: Omit<
					ProductSkuPackage,
					"productSkuId" | "id" | "createdAt" | "updatedAt"
				>[];
			},
			Omit<
				Product,
				"id" | "createdAt" | "manufacturerId" | "updatedAt" | "isDeleted"
			>,
			"product"
		>;

type GetAllQuery<T extends UserRole> = T extends UserRole.Admin
	? GetProductsSkusAdminRequestQuery
	: GetProductsSkusRequestQuery;

export function createProductSkuService(instance: FastifyInstance) {
	const {
		kysely,
		httpErrors,
		fileUploaderManager,
		priceService: { transformPrice },
	} = instance;

	async function getAll<T extends UserRole>(
		query: GetAllQuery<T>,
		role: T,
	): Promise<WithPageCount<GetOneResult<T>[], "productsSkus">> {
		const productsSkus = await buildAdminProductSku()
			.where((eb) => buildFilters(query, eb, role))
			.orderBy("productSku.createdAt", "desc")
			.limit(query.limit)
			.offset(query.limit * query.page - query.limit)
			.execute();

		const { totalCount } = await kysely
			.selectFrom("productSku")
			.innerJoin("product", "product.id", "productSku.productId")
			.select(sql<number>`COUNT(*)::INTEGER`.as("totalCount"))
			.where((eb) => buildFilters(query, eb, role))
			.executeTakeFirstOrThrow();

		if (role === UserRole.Admin) {
			return {
				pageCount: Math.ceil(totalCount / query.limit),
				productsSkus: productsSkus.map((p) => ({
					id: p.id,
					createdAt: p.createdAt,
					updatedAt: p.updatedAt,
					currency: p.currency,
					price: transformPrice(p.price, p.currency, "read"),
					salePrice: p.salePrice
						? transformPrice(p.salePrice, p.currency, "read")
						: null,
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
			} as WithPageCount<GetOneResult<T>[], "productsSkus">;
		}

		return {
			pageCount: Math.ceil(totalCount / query.limit),
			productsSkus: productsSkus.map((p) => ({
				id: p.id,
				currency: p.currency,
				price: transformPrice(p.price, p.currency, "read"),
				salePrice: p.salePrice
					? transformPrice(p.salePrice, p.currency, "read")
					: null,
				quantity: p.quantity,
				sku: p.sku,
				attributes: p.attrs,
				images: p.images,
				packages: p.packages,
				product: {
					name: p.name,
					description: p.description,
					categoryId: p.categoryId,
					shortDescription: p.shortDescription,
					materialsAndCare: p.materialsAndCare,
					assemblyInstructionFileId: p.assemblyInstructionFileId,
					assemblyInstructionFileUrl: p.assemblyInstructionFileUrl,
				},
			})),
		} as WithPageCount<GetOneResult<T>[], "productsSkus">;
	}

	async function getOne<T extends UserRole>(
		param: ProductSkuParam,
		type: T,
		log: FastifyBaseLogger,
	): Promise<GetOneResult<T>> {
		const productSku = await buildAdminProductSku()
			.where("productSku.id", "=", param.productSkuId)
			.executeTakeFirst();

		if (!productSku) {
			log.info("Get product sku failed: product sku not found");
			throw httpErrors.notFound("Product Sku not found");
		}

		if (type === UserRole.Admin) {
			return {
				id: productSku.id,
				createdAt: productSku.createdAt,
				updatedAt: productSku.updatedAt,
				currency: productSku.currency,
				price: transformPrice(productSku.price, productSku.currency, "read"),
				salePrice: productSku.salePrice
					? transformPrice(productSku.salePrice, productSku.currency, "read")
					: null,
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
			} as GetOneResult<T>;
		}

		return {
			id: productSku.id,
			currency: productSku.currency,
			price: transformPrice(productSku.price, productSku.currency, "read"),
			salePrice: productSku.salePrice
				? transformPrice(productSku.salePrice, productSku.currency, "read")
				: null,
			quantity: productSku.quantity,
			sku: productSku.sku,
			attributes: productSku.attrs,
			images: productSku.images,
			packages: productSku.packages,
			product: {
				name: productSku.name,
				categoryId: productSku.categoryId,
				description: productSku.description,
				shortDescription: productSku.shortDescription,
				materialsAndCare: productSku.materialsAndCare,
				assemblyInstructionFileId: productSku.assemblyInstructionFileId,
				assemblyInstructionFileUrl: productSku.assemblyInstructionFileUrl,
			},
		} as GetOneResult<T>;
	}

	async function create(
		data: CreateProductSkuRequest,
		log: FastifyBaseLogger,
	): Promise<
		Omit<ProductSku, "attributes"> & {
			attributes: ProductSkuAttributes;
			images: Pick<ProductSkuImages, "id" | "imageId" | "imageUrl">[];
			packages: Omit<ProductSkuPackage, "productSkuId">[];
		}
	> {
		try {
			const { attributeKeys, attributeValues } = buildAttributes(
				data as ProductSkuAttributes,
			);

			const product = await kysely.transaction().execute(async (trx) => {
				const product = await trx
					.insertInto("productSku")
					.values({
						productId: data.productId,
						sku: randomUUID(),
						currency: data.currency,
						price: transformPrice(data.price, data.currency, "store"),
						salePrice: data.salePrice
							? transformPrice(data.salePrice, data.currency, "store")
							: null,
						quantity: data.quantity,
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
					data.images.map(
						async (file) => await fileUploaderManager.upload(file),
					),
				);

				const [images, packages] = await Promise.all([
					trx
						.insertInto("productSkuImages")
						.values(
							uploadRes.map((res) => ({
								imageId: res.fileId,
								imageUrl: res.fileUrl,
								productSkuId: product.id,
							})),
						)
						.returning(["id", "imageId", "imageUrl"])
						.execute(),
					...(data.packages
						? [
								trx
									.insertInto("productSkuPackage")
									.values(
										data.packages.map((pkg) => ({
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
					images: images.map((image) => ({
						id: image.id,
						imageId: image.imageId,
						imageUrl: image.imageUrl,
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
			throw handleError(err, data, log);
		}
	}

	async function update(
		data: UpdateProductSkuRequest,
		param: ProductSkuParam,
		log: FastifyBaseLogger,
	): Promise<
		Omit<ProductSku, "attributes"> & {
			attributes: ProductSkuAttributes;
			images: Pick<ProductSkuImages, "id" | "imageId" | "imageUrl">[];
			packages: Omit<ProductSkuPackage, "productSkuId">[];
		}
	> {
		try {
			const productSku = await buildAdminProductSku()
				.where("productSku.id", "=", param.productSkuId)
				.executeTakeFirst();

			if (!productSku) {
				log.info("Update product sku failed: product sku not found");
				throw httpErrors.notFound("Product Sku not found");
			}

			const updateData: Partial<
				Omit<
					UpdateProductSku,
					"attributes" | "sku" | "updatedAt" | "createdAt" | "id"
				>
			> = Object.entries(data)
				.filter(
					([key]) =>
						![
							"width",
							"height",
							"length",
							"color",
							"weight",
							"images",
							"packages",
						].includes(key),
				)
				.reduce((acc, [key, value]) => {
					const typedKey = key as keyof UpdateProductSkuRequest;

					if (productSku[typedKey] !== value) {
						acc[typedKey] = value;
					}

					return acc;
				}, {});

			if (
				!updateData.price &&
				updateData.salePrice &&
				updateData.salePrice > productSku.price
			) {
				log.info(
					"Update product SKU failed: sale price must be less than the regular price",
				);
				throw httpErrors.badRequest(
					"Sale price must be less than the regular price",
				);
			}

			const attributes: ProductSkuAttributes = productSku.attrs;

			for (const key of Object.keys(attributes)) {
				if (data[key] && data[key] != attributes[key]) {
					attributes[key] = data[key];
				}
			}

			const buildedAttributes = attributes
				? buildAttributes({
						...attributes,
						...Object.fromEntries(
							Object.entries(productSku.attributes).filter(
								([key]) => !Object.keys(attributes).includes(key),
							),
						),
					})
				: undefined;

			if (
				!Object.keys(updateData).length &&
				!buildedAttributes &&
				!data.images?.length &&
				!data.packages?.length
			) {
				log.info("Update product SKU failed: no changes in request");
				throw httpErrors.badRequest("No changes detected in update request");
			}

			const product = await kysely.transaction().execute(async (trx) => {
				const product = await trx
					.updateTable("productSku")
					.set({
						...updateData,
						...(updateData.price
							? {
									price: transformPrice(
										updateData.price,
										updateData.currency ?? productSku.currency,
										"store",
									),
								}
							: {}),
						...(updateData.salePrice
							? {
									salePrice: transformPrice(
										updateData.salePrice,
										updateData.currency ?? productSku.currency,
										"store",
									),
								}
							: {}),
						...(buildedAttributes
							? {
									attributes: sql`
			   hstore(
			     array[${sql.join(buildedAttributes.attributeKeys)}],
			     array[${sql.join(buildedAttributes.attributeValues)}]
			   )
			 `,
								}
							: {}),
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
					.where("id", "=", param.productSkuId)
					.executeTakeFirstOrThrow();

				const uploadResult: FileUploadResponse[] = data?.images
					? await Promise.all(
							data?.images
								?.slice(
									0,
									ProductSkuImagesMaxLength - (productSku.images?.length ?? 0),
								)
								.map(async (image) => await fileUploaderManager.upload(image)),
						)
					: [];

				const [images, packages] = await Promise.all([
					uploadResult.length
						? trx
								.insertInto("productSkuImages")
								.values(
									uploadResult.map((res) => ({
										imageId: res.fileId,
										imageUrl: res.fileUrl,
										productSkuId: product.id,
									})),
								)
								.returning(["id", "imageId", "imageUrl"])
								.execute()
						: Promise.resolve([]),

					data.packages?.length
						? trx
								.insertInto("productSkuPackage")
								.values(
									data.packages
										.slice(
											0,
											ProductSkuPackagesMaxLength -
												(productSku.packages?.length ?? 0),
										)
										.map((pkg) => ({
											productSkuId: product.id,
											...pkg,
										})),
								)
								.returningAll()
								.execute()
						: Promise.resolve([]),
				]);

				return {
					...product,
					images: [...(productSku.images ?? []), ...images].map((image) => ({
						id: image.id,
						imageId: image.imageId,
						imageUrl: image.imageUrl,
					})),
					packages: [...(productSku.packages ?? []), ...(packages ?? [])].map(
						(p) => ({
							id: p.id,
							createdAt: p.createdAt,
							updatedAt: p.updatedAt,
							quantity: p.quantity,
							width: p.width,
							height: p.height,
							length: p.length,
							weight: p.weight,
						}),
					),
				};
			});

			return product;
		} catch (err) {
			throw handleError(err, data, log);
		}
	}

	async function remove(param: ProductSkuParam, log: FastifyBaseLogger) {
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

	async function deleteImage(
		param: Combined<ProductSkuParam, ProductSkuImages["id"], "imageId">,
		log: FastifyBaseLogger,
	) {
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

	async function deletePackage(
		param: Combined<ProductSkuParam, ProductSkuPackage["id"], "packageId">,
		log: FastifyBaseLogger,
	) {
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
						sql<Pick<ProductSkuImages, "id" | "imageId" | "imageUrl">[]>`
			COALESCE(
			  json_agg(
			    json_build_object(
						'id', product_sku_images.id,
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

	function buildFilters<T extends UserRole>(
		query: GetAllQuery<T>,
		eb: ExpressionBuilder<DB, "product" | "productSku">,
		role: T,
	): ExpressionWrapper<DB, "productSku" | "product", SqlBool> {
		const ands: Expression<SqlBool>[] = [];

		if (role === UserRole.Admin && "isDeleted" in query) {
			if (query.isDeleted !== undefined) {
				ands.push(eb("product.isDeleted", "=", query.isDeleted));
			}
		}

		if ("categoryId" in query && query.categoryId) {
			ands.push(eb("product.categoryId", "=", query.categoryId));
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
			ands.push(
				eb(
					"productSku.price",
					">=",
					transformPrice(query.minPrice, query.currency, "store"),
				),
			);
		}

		if (query.maxPrice) {
			ands.push(
				eb(
					"productSku.price",
					"<=",
					transformPrice(query.maxPrice, query.currency, "store"),
				),
			);
		}

		if (query.minSalePrice) {
			ands.push(
				eb(
					"productSku.salePrice",
					">=",
					transformPrice(query.minSalePrice, query.currency, "store"),
				),
			);
		}

		if (query.maxSalePrice) {
			ands.push(
				eb(
					"productSku.salePrice",
					"<=",
					transformPrice(query.maxSalePrice, query.currency, "store"),
				),
			);
		}

		if (query.sku) {
			ands.push(eb("productSku.sku", "=", query.sku));
		}

		if (query.inStock !== undefined) {
			ands.push(eb("productSku.quantity", ">", 1));
		}

		if (query.withDiscount !== undefined) {
			ands.push(eb("productSku.salePrice", "is not", null));
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

	function handleError(
		err: unknown,
		data: unknown,
		log: FastifyBaseLogger,
	): Error | unknown {
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
				log.info({ data }, logMsg);
				return err.code === ForeignKeyConstraintCode
					? httpErrors.notFound(clientMsg)
					: httpErrors.badRequest(clientMsg);
			}
		}

		return err;
	}

	return {
		getAll,
		getOne,
		create,
		update,
		remove,
		deleteImage,
		deletePackage,
		buildAdminProductSku,
	};
}
