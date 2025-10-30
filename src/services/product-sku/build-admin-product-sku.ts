import {type ProductSkuService} from "@/services/product-sku/product-sku.service.js";
import {ProductSkuAttributes} from "@/schemas/product-sku/product-sku.schema.js";
import {sql} from "kysely";
import {ProductSkuImages, ProductSkuPackage} from "@/types/db/product.js";

export function buildAdminProductSku(this: ProductSkuService) {
	const {kysely} = this.fastify

	return kysely
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
			sql<ProductSkuAttributes>`hstore_to_json
      (product_sku.attributes)`.as(
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


}