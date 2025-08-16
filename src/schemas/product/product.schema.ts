import z from "zod";

export const ProductSchema = z.object({
	id: z.number().positive(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
	name: z.string().nonempty(),
	description: z.string().nonempty(),
	shortDescription: z.string().nonempty(),
	materialsAndCare: z.string().nonempty(),
	isDeleted: z.boolean(),
	assemblyInstructionFileId: z.string().nullable(),
	assemblyInstructionFileUrl: z.string().nullable(),
	categoryId: z.number().positive(),
	manufacturerId: z.number().positive(),
});
