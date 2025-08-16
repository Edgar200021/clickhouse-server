import z from "zod";
import {
	ProductAssemblyInstructionMaxSize,
	ProductDescriptionMaxLength,
	ProductMaterialAndCareMaxLength,
	ProductNameMaxLength,
	ProductShortDescriptionMaxLength,
} from "../../const/zod.js";
import { ProductSchema } from "./product.schema.js";

export const UpdateProductRequestSchema = z.object({
	name: z.string().trim().nonempty().max(ProductNameMaxLength).optional(),
	description: z
		.string()
		.trim()
		.nonempty()
		.max(ProductDescriptionMaxLength)
		.optional(),
	shortDescription: z
		.string()
		.trim()
		.nonempty()
		.max(ProductShortDescriptionMaxLength)
		.optional(),
	materialsAndCare: z
		.string()
		.trim()
		.nonempty()
		.max(ProductMaterialAndCareMaxLength)
		.optional(),
	assemblyInstruction: z
		.file()
		.max(ProductAssemblyInstructionMaxSize)
		.mime(["application/pdf", "text/plain", "text/html"])
		.optional(),
	categoryId: z.coerce.number().positive().optional(),
	manufacturerId: z.coerce.number().positive().optional(),
});
export const UpdateProductResponseSchema = ProductSchema;

export type UpdateProductRequest = z.infer<typeof UpdateProductRequestSchema>;
