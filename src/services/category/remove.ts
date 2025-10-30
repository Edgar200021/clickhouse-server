import {type CategoryService} from "@/services/category/category.service.js";
import {CategoryParam} from "@/schemas/category/category-param.schema.js";
import {FastifyBaseLogger} from "fastify";

export async function remove(this: CategoryService, param: CategoryParam, log: FastifyBaseLogger) {
	const category = await this.fastify.kysely
		.deleteFrom("category")
		.where("id", "=", param.categoryId)
		.returning(["id", "imageId"])
		.executeTakeFirst();

	if (!category) {
		log.info(`Delete category failed: category not found`);
		throw this.fastify.httpErrors.notFound("Category not found");
	}

	if (category.imageId) {
		await this.fastify.fileUploaderManager.deleteFile(category.imageId);
	}

	await this.updateCache();
}