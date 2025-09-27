import z from "zod";

export const PromocodeParamSchema = z.object({
	promocodeId: z.coerce.number().positive(),
});

export type PromocodeParam = z.Infer<typeof PromocodeParamSchema>;
