import type { Kysely } from "kysely";
import { DB } from "../src/types/db/db.js";
import { faker } from "@faker-js/faker";

export async function seed(db: Kysely<DB>): Promise<void> {
	await db
		.insertInto("manufacturer")
		.values([
			{
				name: faker.string.sample(),
			},
			{
				name: faker.string.sample(),
			},
			{
				name: faker.string.sample(),
			},
			{
				name: faker.string.sample(),
			},
			{
				name: faker.string.sample(),
			},
			{
				name: faker.string.sample(),
			},
			{
				name: faker.string.sample(),
			},
			{
				name: faker.string.sample(),
			},
			{
				name: faker.string.sample(),
			},
			{
				name: faker.string.sample(),
			},
			{
				name: faker.string.sample(),
			},
			{
				name: faker.string.sample(),
			},
			{
				name: faker.string.sample(),
			},
			{
				name: faker.string.sample(),
			},
			{
				name: faker.string.sample(),
			},
			{
				name: faker.string.sample(),
			},
			{
				name: faker.string.sample(),
			},
			{
				name: faker.string.sample(),
			},
			{
				name: faker.string.sample(),
			},
			{
				name: faker.string.sample(),
			},
			{
				name: faker.string.sample(),
			},
		])
		.execute();
}
