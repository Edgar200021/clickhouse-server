import z from "zod";

export const CategoryParamSchema = z.object({
	categoryId: z.coerce.number().positive(),
});
