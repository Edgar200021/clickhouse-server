import type { FastifyBaseLogger } from "fastify";
import type { FastifyInstance } from "fastify/types/instance.js";
import { sql } from "kysely";
import { CategoriesKey } from "../const/redis.js";
import type { CategoryParam } from "../schemas/category/category-param.schema.js";
import type { CreateCategoryRequest } from "../schemas/category/create-category.schema.js";
import type { UpdateCategoryRequest } from "../schemas/category/update-category.schema.js";
import type { Nullable } from "../types/base.js";
import type { FileUploadResponse } from "../types/cloudinary.js";
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
	): Promise<Category> {
		const { uploadResult, fullPath } = await isValid(
			{ action: "create", data: { ...data } },
			log,
		);

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

	async function updateCategory(
		data: UpdateCategoryRequest,
		param: CategoryParam,
		log: FastifyBaseLogger,
	): Promise<Category> {
		const category = await kysely
			.selectFrom("category")
			.selectAll()
			.where("id", "=", param.categoryId)
			.executeTakeFirst();

		if (!category) {
			log.info("Update category failed: category not found");
			throw httpErrors.notFound("Category not found");
		}

		data.predefinedPath ??= category.path.includes(".")
			? category.path.slice(0, category.path.lastIndexOf("."))
			: undefined;

		data.path ??= category.path.includes(".")
			? category.path.slice(category.path.lastIndexOf(".") + 1)
			: category.path;

		const { fullPath, uploadResult } = await isValid(
			{ action: "update", data: { ...data, ...param } },
			log,
		);

		if (uploadResult && category.imageId) {
			await fileUploaderManager.deleteFile(category.imageId);
		}

		const updateData: Partial<Category> = {};

		if (data.name && data.name !== category.name) {
			updateData.name = data.name;
		}

		if (uploadResult) {
			updateData.imageId = uploadResult.fileId;
			updateData.imageUrl = uploadResult.fileUrl;
		}

		if (fullPath && fullPath !== category.path) {
			updateData.path = fullPath;
		}

		if (!Object.keys(updateData).length) {
			return category;
		}

		const updatedCategory = await kysely
			.updateTable("category")
			.set(updateData)
			.where("id", "=", Number(param.categoryId))
			.returningAll()
			.executeTakeFirstOrThrow();

		await updateCache();

		return updatedCategory;
	}

	async function deleteCategory(param: CategoryParam, log: FastifyBaseLogger) {
		const category = await kysely
			.deleteFrom("category")
			.where("id", "=", param.categoryId)
			.returning(["id", "imageId"])
			.executeTakeFirst();

		if (!category) {
			log.info(`Delete category failed: category not found`);
			throw httpErrors.notFound("Category not found");
		}

		if (category.imageId) {
			await fileUploaderManager.deleteFile(category.imageId);
		}

		await updateCache();
	}

	async function isValid<
		T extends
			| { action: "create"; data: CreateCategoryRequest }
			| { action: "update"; data: UpdateCategoryRequest & CategoryParam },
	>(
		{ data, action }: T,
		log: FastifyBaseLogger,
	): Promise<{
		fullPath: T extends { action: "create" } ? string : Nullable<string>;
		uploadResult: FileUploadResponse | null;
	}> {
		if (data.predefinedPath) {
			const existingCategory = await kysely
				.selectFrom("category")
				.where("path", "=", data.predefinedPath)
				.executeTakeFirst();

			if (!existingCategory) {
				log.info(
					`${action} category failed: parent category with predefinedPath not found`,
				);
				throw httpErrors.notFound(
					"Parent category with predefinedPath not found",
				);
			}
		}

		const fullPath = `${data.predefinedPath ? `${data.predefinedPath}.` : ""}${data.path ?? ""}`;

		if (fullPath) {
			const existingCategory = await kysely
				.selectFrom("category")
				.select("id")
				.where("path", "=", fullPath)
				.executeTakeFirst();

			if (
				existingCategory &&
				(action === "create" ||
					(action === "update" && existingCategory.id !== data.categoryId))
			) {
				log.info(`${action} category failed: category already exists`);
				throw httpErrors.badRequest("Category already exists");
			}
		}

		const uploadResult = data.image
			? await fileUploaderManager.uploadFromBuffer(
					Buffer.from(await data.image.arrayBuffer()),
				)
			: null;

		return {
			uploadResult,
			fullPath: (fullPath || null) as T extends { action: "create" }
				? string
				: Nullable<string>,
		};
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
		updateCategory,
		deleteCategory,
	};
}
