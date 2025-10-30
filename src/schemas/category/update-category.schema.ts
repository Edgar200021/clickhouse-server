import z from "zod";
import {
	CategoryImageMaxSize,
	CategoryPathMaxLength,
	CategoryPredefinedPathMaxLength,
} from "@/const/zod.js";
import { CategorySchema } from "./category.schema.js";

export const UpdateCategoryRequestSchema = z.object({
	name: z.string().nonempty().max(CategoryPathMaxLength).optional(),
	path: z
		.string()
		.nonempty()
		.regex(/^[a-z]+$/i, "The field can only contain Latin letters.")
		.max(CategoryPathMaxLength)
		.optional(),
	predefinedPath: z
		.string()
		.nonempty()
		.regex(
			/^[a-z]+(\.[a-z]+)?$/i,
			"Must be either a single word or two parts separated by a dot, only Latin letters.",
		)
		.max(CategoryPredefinedPathMaxLength)
		.optional(),
	image: z
		.file()
		.max(CategoryImageMaxSize)
		.mime(["image/jpeg", "image/png", "image/webp"])
		.optional(),
});

export const UpdateCategoryResponseSchema = CategorySchema;

export type UpdateCategoryRequest = z.Infer<typeof UpdateCategoryRequestSchema>;