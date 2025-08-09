import type { FastifyBaseLogger } from "fastify";
import type { FastifyInstance } from "fastify/types/instance.js";
import { sql } from "kysely";
import { CategoriesKey } from "../const/redis.js";
import type { CreateCategoryRequest } from "../schemas/category/create-category.schema.js";
import type { Category } from "../types/db/category.js";

export function createCategoryService(instance: FastifyInstance) {
	const { kysely, redis, httpErrors, fileUploaderManager } = instance;

	async function getCategories(): Promise<Category[]> {
		const redisCategories = await redis.get(CategoriesKey);

		if (redisCategories) {
			return JSON.parse(redisCategories);
		}

		const categories = await updateCache();

		return categories;
	}

	async function createCategory(
		data: CreateCategoryRequest,
		log: FastifyBaseLogger,
	) {
		if (data.predefinedPath) {
			const existingCategory = await kysely
				.selectFrom("category")
				.where("path", "=", data.predefinedPath)
				.executeTakeFirst();

			log.info("Create category failed: category not found");
			if (!existingCategory) throw httpErrors.notFound("Category not found");
		}

		const fullPath = `${data.predefinedPath ? `${data.predefinedPath}.` : ""}${data.path}`;

		const existingCategory = await kysely
			.selectFrom("category")
			.where("path", "=", fullPath)
			.executeTakeFirst();

		log.error({ fullPath }, "\n\n\n\nEXISTING\n\n\n\n");

		if (existingCategory) {
			log.info("Create category failed: category already exists");
			throw httpErrors.badRequest("Category already exists");
		}

		const uploadResult = data.file
			? await fileUploaderManager.uploadFromBuffer(
					Buffer.from(await data.file.arrayBuffer()),
				)
			: null;

		const newCategory = await kysely
			.insertInto("category")
			.values({
				name: data.name,
				path: fullPath,
				createdAt: sql`NOW()`,
				updatedAt: sql`NOW()`,
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

	async function updateCache() {
		const categories = await kysely
			.selectFrom("category")
			.selectAll("category")
			.execute();

		await redis.set(CategoriesKey, JSON.stringify(categories));

		return categories;
	}

	return {
		getCategories,
		createCategory,
	};
}
