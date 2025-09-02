import z from "zod";

export const ProductSchema = z.object({
	id: z.number().positive(),
	name: z.string().nonempty(),
	description: z.string().nonempty(),
	shortDescription: z.string().nonempty(),
	materialsAndCare: z.string().nonempty(),
	assemblyInstructionFileId: z.string().nullable(),
	assemblyInstructionFileUrl: z.string().nullable(),
});

export const ProductAdminSchema = ProductSchema.extend({
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
	isDeleted: z.boolean(),
	categoryId: z.number().positive(),
	manufacturerId: z.number().positive(),
});
