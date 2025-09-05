import type z from "zod";
import { CreateProductSkuRequestSchema } from "./create-product-sku.schema.js";
import { ProductSkuAdminSchema } from "./product-sku.schema.js";

export const UpdateProductSkuRequestSchema =
	CreateProductSkuRequestSchema.partial()
		.omit({
			productId: true,
		})
		.refine(
			(obj) => (obj.salePrice && obj.price ? obj.salePrice < obj.price : true),
			{
				error: "Sale price must be less than the regular price",
			},
		);

export const UpdateProductSkuResponseSchema = ProductSkuAdminSchema;

export type UpdateProductSkuRequest = z.Infer<
	typeof UpdateProductSkuRequestSchema
>;
