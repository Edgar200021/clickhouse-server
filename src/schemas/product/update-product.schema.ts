import z from "zod";
import {
	ProductAssemblyInstructionMaxSize,
	ProductDescriptionMaxLength,
	ProductMaterialAndCareMaxLength,
	ProductNameMaxLength,
	ProductShortDescriptionMaxLength,
} from "@/const/zod.js";
import { ProductAdminSchema } from "./product.schema.js";

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
export const UpdateProductResponseSchema = ProductAdminSchema;

export type UpdateProductRequest = z.Infer<typeof UpdateProductRequestSchema>;