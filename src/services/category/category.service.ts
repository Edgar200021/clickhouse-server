import fp from "fastify-plugin"
import {type FastifyBaseLogger, FastifyInstance} from "fastify";
import {CategoriesKey} from "@/const/redis.js";
import type {CreateCategoryRequest} from "@/schemas/category/create-category.schema.js";
import type {UpdateCategoryRequest} from "@/schemas/category/update-category.schema.js";
import type {CategoryParam} from "@/schemas/category/category-param.schema.js";
import type {Nullable} from "@/types/base.js";
import type {FileUploadResponse} from "@/types/cloudinary.js";
import {getAll} from "@/services/category/get-all.js";
import {create} from "@/services/category/create.js";
import {remove} from "@/services/category/remove.js";
import {update} from "@/services/category/update.js";


declare module "fastify" {
	export interface FastifyInstance {
		categoryService: CategoryService
	}
}

export class CategoryService {
	getAll = getAll
	create = create
	update = update
	remove = remove

	constructor(readonly fastify: FastifyInstance) {
		this.isValid = this.isValid.bind(this)
		this.updateCache = this.updateCache.bind(this)
	}


	async isValid<
		T extends | { action: "create"; data: CreateCategoryRequest }
			| { action: "update"; data: UpdateCategoryRequest & CategoryParam },
	>(
		{data, action}: T,
		log: FastifyBaseLogger,
	): Promise<{
		fullPath: T extends { action: "create" } ? string : Nullable<string>;
		uploadResult: FileUploadResponse | null;
	}> {
		if (data.predefinedPath) {
			const existingCategory = await this.fastify.kysely
				.selectFrom("category")
				.where("path", "=", data.predefinedPath)
				.executeTakeFirst();

			if (!existingCategory) {
				log.info(
					`${action} category failed: parent category with predefinedPath not found`,
				);
				throw this.fastify.httpErrors.notFound(
					"Parent category with predefinedPath not found",
				);
			}
		}

		const fullPath = `${data.predefinedPath ? `${data.predefinedPath}.` : ""}${data.path ?? ""}`;

		if (fullPath) {
			const existingCategory = await this.fastify.kysely
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
				throw this.fastify.httpErrors.badRequest("Category already exists");
			}
		}

		const uploadResult = data.image
			? await this.fastify.fileUploaderManager.upload(
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

	async updateCache() {
		const categories = await this.fastify.kysely
			.selectFrom("category")
			.selectAll("category")
			.execute();

		await this.fastify.redis.set(CategoriesKey, JSON.stringify(categories));

		return categories;
	}

}


export default fp(async (fastify: FastifyInstance) => {
	fastify.decorate("categoryService", new CategoryService(fastify))
}, {
	name: "categoryService"
})