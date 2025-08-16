import z from "zod";
import { ProductAssemblyInstructionMaxSize } from "../../const/zod.js";
import { ProductSchema } from "./product.schema.js";

export const CreateProductRequestSchema = z.object({
	name: z.string().trim().nonempty(),
	description: z.string().trim().nonempty(),
	shortDescription: z.string().trim().nonempty(),
	materialsAndCare: z.string().trim().nonempty(),
	assemblyInstruction: z
		.file()
		.max(ProductAssemblyInstructionMaxSize)
		.mime(["application/pdf", "text/plain", "text/html"])
		.optional(),
	categoryId: z.coerce.number().positive(),
	manufacturerId: z.coerce.number().positive(),
});
export const CreateProductResponseSchema = ProductSchema;

export type CreateProductRequest = z.infer<typeof CreateProductRequestSchema>;
