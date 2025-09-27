import z from "zod";

export const ProductSchema = z.object({
	name: z.string().nonempty(),
	description: z.string().nonempty(),
	shortDescription: z.string().nonempty(),
	materialsAndCare: z.string().nonempty(),
	assemblyInstructionFileId: z.string().nullable(),
	assemblyInstructionFileUrl: z.string().nullable(),
	categoryId: z.number().positive().nullable(),
});

export const ProductAdminSchema = ProductSchema.extend({
	id: z.number().positive(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
	isDeleted: z.boolean(),
	manufacturerId: z.number().positive(),
});
