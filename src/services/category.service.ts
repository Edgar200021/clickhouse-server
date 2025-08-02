import type { FastifyInstance } from "fastify/types/instance.js";
import { CategoriesKey } from "../const/redis.js";
import type { Category } from "../types/db/category.js";

export function createCategoryService(instance: FastifyInstance) {
	const { kysely, redis } = instance;

	async function getCategories(): Promise<Category[]> {
		const redisCategories = await redis.get(CategoriesKey);

		if (redisCategories) {
			return JSON.parse(redisCategories);
		}

		const categories = await kysely
			.selectFrom("category")
			.selectAll()
			.execute();

		await redis.set(CategoriesKey, JSON.stringify(categories));

		return categories;
	}

	return {
		getCategories,
	};
}
