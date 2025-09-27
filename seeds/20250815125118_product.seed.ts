import { faker } from "@faker-js/faker";
import type { Kysely } from "kysely";
import type { DB } from "../src/types/db/db.js";

export async function seed(db: Kysely<DB>): Promise<void> {
	const categories = await db.selectFrom("category").selectAll().execute();

	for (const category of categories) {
		await db
			.insertInto("product")
			.values([
				...[...Array(20)].map((_, i) => ({
					name: faker.string.sample(),
					description: faker.string.sample(),
					shortDescription: faker.string.sample(),
					materialsAndCare: faker.string.sample(),
					categoryId: category.id,
					manufacturerId: 1,
				})),
				{
					name: faker.string.sample(),
					description: faker.string.sample(),
					shortDescription: faker.string.sample(),
					materialsAndCare: faker.string.sample(),
					categoryId: category.id,
					manufacturerId: 1,
					isDeleted: true,
				},
			])
			.execute();
	}
}
