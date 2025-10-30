import {CategoryParam} from "@/schemas/category/category-param.schema.js";
import {UpdateCategoryRequest} from "@/schemas/category/update-category.schema.js";
import {FastifyBaseLogger} from "fastify";
import {Category} from "@/types/db/category.js";
import {type CategoryService} from "@/services/category/category.service.js";

export async function update(
	this: CategoryService,
	data: UpdateCategoryRequest,
	param: CategoryParam,
	log: FastifyBaseLogger,
): Promise<Category> {
	const {fastify: {kysely, httpErrors, fileUploaderManager}, isValid, updateCache} = this

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

	const {fullPath, uploadResult} = await isValid(
		{action: "update", data: {...data, ...param}},
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