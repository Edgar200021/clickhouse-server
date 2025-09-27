import z from "zod";

export const CartItemParamSchema = z.object({
	cartItemId: z.coerce.number().positive(),
});

export type CartItemParam = z.Infer<typeof CartItemParamSchema>;
