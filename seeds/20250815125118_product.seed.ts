import type { Kysely } from "kysely";
import { DB } from "../src/types/db/db.js";
import { faker } from "@faker-js/faker";
export async function seed(db: Kysely<DB>): Promise<void> {
	const categories = await db.selectFrom("category").selectAll().execute();

	await db
		.insertInto("product")
		.values([
			{
				name: faker.string.sample(),
				description: faker.string.sample(),
				shortDescription: faker.string.sample(),
				materialsAndCare: faker.string.sample(),
				categoryId:
					categories[Math.floor(Math.random() * categories.length)].id,
				manufacturerId: 1,
			},
			{
				name: faker.string.sample(),
				description: faker.string.sample(),
				shortDescription: faker.string.sample(),
				materialsAndCare: faker.string.sample(),
				categoryId:
					categories[Math.floor(Math.random() * categories.length)].id,
				manufacturerId: 1,
			},
			{
				name: faker.string.sample(),
				description: faker.string.sample(),
				shortDescription: faker.string.sample(),
				materialsAndCare: faker.string.sample(),
				categoryId:
					categories[Math.floor(Math.random() * categories.length)].id,
				manufacturerId: 1,
			},
			{
				name: faker.string.sample(),
				description: faker.string.sample(),
				shortDescription: faker.string.sample(),
				materialsAndCare: faker.string.sample(),
				categoryId:
					categories[Math.floor(Math.random() * categories.length)].id,
				manufacturerId: 1,
			},
			{
				name: faker.string.sample(),
				description: faker.string.sample(),
				shortDescription: faker.string.sample(),
				materialsAndCare: faker.string.sample(),
				categoryId:
					categories[Math.floor(Math.random() * categories.length)].id,
				manufacturerId: 1,
			},
			{
				name: faker.string.sample(),
				description: faker.string.sample(),
				shortDescription: faker.string.sample(),
				materialsAndCare: faker.string.sample(),
				categoryId:
					categories[Math.floor(Math.random() * categories.length)].id,
				manufacturerId: 1,
			},
			{
				name: faker.string.sample(),
				description: faker.string.sample(),
				shortDescription: faker.string.sample(),
				materialsAndCare: faker.string.sample(),
				categoryId:
					categories[Math.floor(Math.random() * categories.length)].id,
				manufacturerId: 1,
			},
			{
				name: faker.string.sample(),
				description: faker.string.sample(),
				shortDescription: faker.string.sample(),
				materialsAndCare: faker.string.sample(),
				categoryId:
					categories[Math.floor(Math.random() * categories.length)].id,
				manufacturerId: 1,
			},
			{
				name: faker.string.sample(),
				description: faker.string.sample(),
				shortDescription: faker.string.sample(),
				materialsAndCare: faker.string.sample(),
				categoryId:
					categories[Math.floor(Math.random() * categories.length)].id,
				manufacturerId: 1,
			},
			{
				name: faker.string.sample(),
				description: faker.string.sample(),
				shortDescription: faker.string.sample(),
				materialsAndCare: faker.string.sample(),
				categoryId:
					categories[Math.floor(Math.random() * categories.length)].id,
				manufacturerId: 1,
			},
			{
				name: faker.string.sample(),
				description: faker.string.sample(),
				shortDescription: faker.string.sample(),
				materialsAndCare: faker.string.sample(),
				categoryId:
					categories[Math.floor(Math.random() * categories.length)].id,
				manufacturerId: 1,
			},
			{
				name: faker.string.sample(),
				description: faker.string.sample(),
				shortDescription: faker.string.sample(),
				materialsAndCare: faker.string.sample(),
				categoryId:
					categories[Math.floor(Math.random() * categories.length)].id,
				manufacturerId: 1,
			},
			{
				name: faker.string.sample(),
				description: faker.string.sample(),
				shortDescription: faker.string.sample(),
				materialsAndCare: faker.string.sample(),
				categoryId:
					categories[Math.floor(Math.random() * categories.length)].id,
				manufacturerId: 1,
			},
			{
				name: faker.string.sample(),
				description: faker.string.sample(),
				shortDescription: faker.string.sample(),
				materialsAndCare: faker.string.sample(),
				categoryId:
					categories[Math.floor(Math.random() * categories.length)].id,
				manufacturerId: 1,
			},
			{
				name: faker.string.sample(),
				description: faker.string.sample(),
				shortDescription: faker.string.sample(),
				materialsAndCare: faker.string.sample(),
				categoryId:
					categories[Math.floor(Math.random() * categories.length)].id,
				manufacturerId: 1,
			},
			{
				name: faker.string.sample(),
				description: faker.string.sample(),
				shortDescription: faker.string.sample(),
				materialsAndCare: faker.string.sample(),
				categoryId:
					categories[Math.floor(Math.random() * categories.length)].id,
				manufacturerId: 1,
			},
			{
				name: faker.string.sample(),
				description: faker.string.sample(),
				shortDescription: faker.string.sample(),
				materialsAndCare: faker.string.sample(),
				categoryId:
					categories[Math.floor(Math.random() * categories.length)].id,
				manufacturerId: 1,
			},
			{
				name: faker.string.sample(),
				description: faker.string.sample(),
				shortDescription: faker.string.sample(),
				materialsAndCare: faker.string.sample(),
				categoryId:
					categories[Math.floor(Math.random() * categories.length)].id,
				manufacturerId: 1,
			},
			{
				name: faker.string.sample(),
				description: faker.string.sample(),
				shortDescription: faker.string.sample(),
				materialsAndCare: faker.string.sample(),
				categoryId:
					categories[Math.floor(Math.random() * categories.length)].id,
				manufacturerId: 1,
			},
			{
				name: faker.string.sample(),
				description: faker.string.sample(),
				shortDescription: faker.string.sample(),
				materialsAndCare: faker.string.sample(),
				categoryId:
					categories[Math.floor(Math.random() * categories.length)].id,
				manufacturerId: 1,
			},
			{
				name: faker.string.sample(),
				description: faker.string.sample(),
				shortDescription: faker.string.sample(),
				materialsAndCare: faker.string.sample(),
				categoryId:
					categories[Math.floor(Math.random() * categories.length)].id,
				manufacturerId: 1,
			},
		])
		.execute();
}
