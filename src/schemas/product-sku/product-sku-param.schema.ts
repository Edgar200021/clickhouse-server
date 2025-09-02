import z from "zod";

export const ProductSkuParamSchema = z.object({
	productSkuId: z.coerce.number().positive(),
});

export type ProductSkuParam = z.Infer<typeof ProductSkuParamSchema>;
