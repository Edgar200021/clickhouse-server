import type {Category} from "@/types/db/category.js";
import {CategoriesKey} from "@/const/redis.js";
import {type CategoryService} from "@/services/category/category.service.js";

export async function getAll(this: CategoryService): Promise<Category[]> {
	const redisCategories = await this.fastify.redis.get(CategoriesKey);

	if (redisCategories) {
		return JSON.parse(redisCategories);
	}

	return await this.updateCache();
}