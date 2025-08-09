import z from "zod";
import { CategoryImageMaxSize } from "../../const/zod.js";
import { CategorySchema } from "./category.schema.js";

export const UpdateCategoryRequestSchema = z
	.object({
		name: z.string().optional(),
		path: z.string().optional(),
		predefinedPath: z.string().optional(),
		image: z
			.file()
			.max(CategoryImageMaxSize)
			.mime(["image/jpeg", "image/png", "image/webp"])
			.optional(),
	})
	.check((s) => {
		if (s.value.predefinedPath && !s.value.path) {
			s.issues.push({
				code: "custom",
				message: "",
				path: ["path"],
				input: s.value.path,
			});
		}
	});

export const UpdateCategoryResponseSchema = CategorySchema;
