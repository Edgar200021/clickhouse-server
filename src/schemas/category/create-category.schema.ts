import type { MultipartFile } from "@fastify/multipart";
import z from "zod";
import { CategoryImageMaxSize } from "../../const/zod.js";
import { CategorySchema } from "./category.schema.js";

export const CreateCategoryRequestSchema = z.object({
	name: z.string(),
	path: z
		.string()
		.regex(/^[a-z]+$/i, "The field can only contain Latin letters."),
	predefinedPath: z
		.string()
		.regex(
			/^[a-z]+(\.[a-z]+)?$/i,
			"Must be either a single word or two parts separated by a dot, only Latin letters.",
		)
		.optional(),
	file: z
		.file()
		.max(CategoryImageMaxSize)
		.mime(["image/jpeg", "image/png", "image/webp"]),
});

export const CreateCategoryResponseSchema = CategorySchema;

export type CreateCategoryRequest = z.Infer<typeof CreateCategoryRequestSchema>;
