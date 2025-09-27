import z from "zod";
import {
	GetCartItemsDefaultLimit,
	GetCartItemsMaxLimit,
} from "../../const/zod.js";
import { PromocodeType } from "../../types/db/db.js";
import { GenericSchema } from "../base.schema.js";
import { ProductSchema } from "../product/product.schema.js";
import { ProductSkuSchema } from "../product-sku/product-sku.schema.js";
import { PromocodeSchema } from "../promocode/promocode.schema.js";

export const GetCartRequestQuerySchema = z.object({
	limit: z.coerce
		.number()
		.positive()
		.max(GetCartItemsMaxLimit)
		.optional()
		.default(GetCartItemsDefaultLimit),
	page: z.coerce.number().positive().optional().default(1),
});

export const GetCartResponseSchema = z.object({
	totalPrice: z.number().gte(0),
	promocode: z.union([PromocodeSchema, z.null()]),
	cartItems: z.array(
		GenericSchema(
			ProductSkuSchema.pick({
				id: true,
				sku: true,
				currency: true,
				price: true,
				salePrice: true,
				images: true,
			}).extend({
				id: z.number().positive(),
				quantity: z.number().positive(),
				productSkuId: z.number().positive(),
				productSkuQuantity: z.number().gte(0),
			}),
			["product"],
			[ProductSchema.pick({ name: true, shortDescription: true })],
		),
	),
});

export type GetCartRequestQuery = z.Infer<typeof GetCartRequestQuerySchema>;
