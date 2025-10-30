import type {CreateCategoryRequest} from "@/schemas/category/create-category.schema.js";
import type {FastifyBaseLogger} from "fastify";
import type {Category} from "@/types/db/category.js";
import {type CategoryService} from "@/services/category/category.service.js";
import {sql} from "kysely";

export async function create(
	this: CategoryService,
	data: CreateCategoryRequest,
	log: FastifyBaseLogger,
): Promise<Category> {
	const {fastify: {kysely}, isValid, updateCache} = this

	const {uploadResult, fullPath} = await isValid(
		{action: "create", data: {...data}},
		log,
	);

	const newCategory = await kysely
		.insertInto("category")
		.values({
			name: data.name,
			path: fullPath,
			createdAt: sql`NOW
      ()`,
			updatedAt: sql`NOW
      ()`,
			...(uploadResult
				? {
					imageId: uploadResult.fileId,
					imageUrl: uploadResult.fileUrl,
				}
				: {}),
		})
		.returningAll()
		.executeTakeFirstOrThrow();

	await updateCache();

	return newCategory;
}