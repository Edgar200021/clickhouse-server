import z from "zod";

export const ProductParamSchema = z.object({
	productId: z.coerce.number().positive(),
});

export type ProductParam = z.Infer<typeof ProductParamSchema>;
