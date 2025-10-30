import {UpdateProductSkuRequest} from "@/schemas/product-sku/update-product-sku.schema.js";
import {ProductSkuParam} from "@/schemas/product-sku/product-sku-param.schema.js";
import {FastifyBaseLogger} from "fastify";
import {
	ProductSku,
	ProductSkuImages,
	ProductSkuPackage,
	UpdateProductSku
} from "@/types/db/product.js";
import {ProductSkuAttributes} from "@/schemas/product-sku/product-sku.schema.js";
import {type ProductSkuService} from "@/services/product-sku/product-sku.service.js";
import {sql} from "kysely";
import {Currency} from "@/types/db/db.js";
import {FileUploadResponse} from "@/types/cloudinary.js";
import {ProductSkuImagesMaxLength, ProductSkuPackagesMaxLength} from "@/const/zod.js";

export async function update(
	this: ProductSkuService,
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
	const {httpErrors, priceService, kysely, fileUploaderManager} = this.fastify

	try {
		const productSku = await this.buildAdminProductSku()
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
			? this.buildAttributes({
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
							price: priceService.transformPrice(
								updateData.price,
								Currency.Rub,
								"store",
							),
						}
						: {}),
					...(updateData.salePrice
						? {
							salePrice: priceService.transformPrice(
								updateData.salePrice,
								Currency.Rub,
								"store",
							),
						}
						: {}),
					...(buildedAttributes
						? {
							attributes: sql`
                  hstore
                  (
			     array[
                  ${sql.join(buildedAttributes.attributeKeys)}
                  ],
                  array
                  [
                  ${sql.join(buildedAttributes.attributeValues)}
                  ]
                  )
							`,
						}
						: {}),
				})
				.returning([
					"id",
					"productId",
					"sku",
					"price",
					"salePrice",
					"quantity",
					sql<ProductSkuAttributes>`hstore_to_json
          (product_sku.attributes)`.as(
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
		throw this.handleError(err, data, log);
	}
}