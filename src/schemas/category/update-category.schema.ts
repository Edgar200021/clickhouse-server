import z from "zod";
import { CategoryImageMaxSize } from "../../const/zod.js";
import { CategorySchema } from "./category.schema.js";

export const UpdateCategoryRequestSchema = z.object({
	name: z.string().nonempty().optional(),
	path: z
		.string()
		.nonempty()
		.regex(/^[a-z]+$/i, "The field can only contain Latin letters.")
		.optional(),
	predefinedPath: z
		.string()
		.nonempty()
		.regex(
			/^[a-z]+(\.[a-z]+)?$/i,
			"Must be either a single word or two parts separated by a dot, only Latin letters.",
		)
		.optional(),
	image: z
		.file()
		.max(CategoryImageMaxSize)
		.mime(["image/jpeg", "image/png", "image/webp"])
		.optional(),
});

export const UpdateCategoryResponseSchema = CategorySchema;

export type UpdateCategoryRequest = z.Infer<typeof UpdateCategoryRequestSchema>;
