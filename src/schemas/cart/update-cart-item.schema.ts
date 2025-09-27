import z from "zod";

import { AddCartItemRequestSchema } from "./add-cart-item.schema.js";

export const UpdateCartItemRequestSchema = AddCartItemRequestSchema.pick({
	quantity: true,
});

export const UpdateCartItemResponseSchema = z.null();

export type UpdateCartItemRequest = z.Infer<typeof UpdateCartItemRequestSchema>;
