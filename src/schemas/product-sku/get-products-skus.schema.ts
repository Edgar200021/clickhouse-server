import z from "zod";
import { GenericSchema, WithPageCountSchema } from "../base.schema.js";
import { ProductSchema } from "../product/product.schema.js";
import { GetProductsSkusAdminRequestQuerySchema } from "./get-products-skus-admin.schema.js";
import { ProductSkuSchema } from "./product-sku.schema.js";

export const GetProductsSkusRequestQuerySchema =
	GetProductsSkusAdminRequestQuerySchema.omit({
		isDeleted: true,
	})
		.extend({
			categoryId: z.coerce.number().positive().optional(),
		})
		.refine((schema) => {
			if (schema.minPrice && schema.maxPrice)
				return schema.minPrice <= schema.maxPrice;

			return true;
		})
		.refine((schema) => {
			if (schema.minSalePrice && schema.maxSalePrice)
				return schema.minSalePrice <= schema.maxSalePrice;

			return true;
		});

export const GetProductsSkusResponseSchema = WithPageCountSchema(
	"productsSkus",
	z.array(GenericSchema(ProductSkuSchema, "product", ProductSchema)),
);

export type GetProductsSkusRequestQuery = z.Infer<
	typeof GetProductsSkusRequestQuerySchema
>;
