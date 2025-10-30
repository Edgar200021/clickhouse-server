import type {CreateProductSkuRequest} from "@/schemas/product-sku/create-product-sku.schema.js";
import type {FastifyBaseLogger} from "fastify";
import type {ProductSku, ProductSkuImages, ProductSkuPackage} from "@/types/db/product.js";
import type {ProductSkuAttributes} from "@/schemas/product-sku/product-sku.schema.js";
import {randomUUID} from "node:crypto";
import {Currency} from "@/types/db/db.js";
import {sql} from "kysely"
import {type ProductSkuService} from "@/services/product-sku/product-sku.service.js";

export async function create(
	this: ProductSkuService,
	data: CreateProductSkuRequest,
	log: FastifyBaseLogger,
): Promise<
	Omit<ProductSku, "attributes"> & {
	attributes: ProductSkuAttributes;
	images: Pick<ProductSkuImages, "id" | "imageId" | "imageUrl">[];
	packages: Omit<ProductSkuPackage, "productSkuId">[];
}
> {
	const {kysely, priceService, httpErrors, fileUploaderManager} = this.fastify

	try {
		const {attributeKeys, attributeValues} = this.buildAttributes(
			data as ProductSkuAttributes,
		);

		const product = await kysely.transaction().execute(async (trx) => {
			const product = await trx
				.insertInto("productSku")
				.values({
					productId: data.productId,
					sku: randomUUID(),
					price: priceService.transformPrice(data.price, Currency.Rub, "store"),
					salePrice: data.salePrice
						? priceService.transformPrice(data.salePrice, Currency.Rub, "store")
						: null,
					quantity: data.quantity,
					attributes: sql`
              hstore
              (
        array[
              ${sql.join(attributeKeys)}
              ],
              array
              [
              ${sql.join(attributeValues)}
              ]
              )
					`,
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
		throw this.handleError(err, data, log);
	}
}