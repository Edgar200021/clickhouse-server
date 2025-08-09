import z from "zod";

export const CategorySchema = z.object({
	id: z.number().positive(),
	name: z.string(),
	path: z.string(),
	imageId: z.string().nullable(),
	imageUrl: z.string().nullable(),
});
