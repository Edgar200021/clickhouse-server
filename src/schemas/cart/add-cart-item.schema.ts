import z from "zod";
import { CartItemMaxQuantityPerProduct } from "../../const/zod.js";

import { ProductSkuParamSchema } from "../product-sku/product-sku-param.schema.js";

export const AddCartItemRequestSchema = ProductSkuParamSchema.extend({
	quantity: z.coerce.number().positive().max(CartItemMaxQuantityPerProduct),
});

export const AddCartItemResponseSchema = z.null();

export type AddCartItemRequest = z.Infer<typeof AddCartItemRequestSchema>;
