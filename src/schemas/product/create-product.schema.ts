import z from "zod";
import {
	ProductAssemblyInstructionMaxSize,
	ProductDescriptionMaxLength,
	ProductMaterialAndCareMaxLength,
	ProductNameMaxLength,
	ProductShortDescriptionMaxLength,
} from "../../const/zod.js";
import { ProductAdminSchema } from "./product.schema.js";

export const CreateProductRequestSchema = z.object({
	name: z.string().trim().nonempty().max(ProductNameMaxLength),
	description: z.string().trim().nonempty().max(ProductDescriptionMaxLength),
	shortDescription: z
		.string()
		.trim()
		.nonempty()
		.max(ProductShortDescriptionMaxLength),
	materialsAndCare: z
		.string()
		.trim()
		.nonempty()
		.max(ProductMaterialAndCareMaxLength),
	assemblyInstruction: z
		.file()
		.max(ProductAssemblyInstructionMaxSize)
		.mime(["application/pdf", "text/plain", "text/html"])
		.optional(),
	categoryId: z.coerce.number().positive(),
	manufacturerId: z.coerce.number().positive(),
});
export const CreateProductResponseSchema = ProductAdminSchema;

export type CreateProductRequest = z.Infer<typeof CreateProductRequestSchema>;
