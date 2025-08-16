import { faker } from "@faker-js/faker";
import type { Kysely } from "kysely";
import { SignUpPasswordMinLength } from "../src/const/zod.js";
import type { DB } from "../src/types/db/db.js";

export async function seed(db: Kysely<DB>): Promise<void> {
	await db
		.insertInto("users")
		.values([
			{
				email: faker.internet.email(),
				password: faker.internet.password({ length: SignUpPasswordMinLength }),
				isBanned: true,
			},
			{
				email: faker.internet.email(),
				password: faker.internet.password({ length: SignUpPasswordMinLength }),
			},
			{
				email: faker.internet.email(),
				password: faker.internet.password({ length: SignUpPasswordMinLength }),
				isVerified: true,
			},
			{
				email: faker.internet.email(),
				password: faker.internet.password({ length: SignUpPasswordMinLength }),
				isBanned: true,
			},
			{
				email: faker.internet.email(),
				password: faker.internet.password({ length: SignUpPasswordMinLength }),
			},
			{
				email: faker.internet.email(),
				password: faker.internet.password({ length: SignUpPasswordMinLength }),
				isVerified: true,
			},
			{
				email: faker.internet.email(),
				password: faker.internet.password({ length: SignUpPasswordMinLength }),
			},
			{
				email: faker.internet.email(),
				password: faker.internet.password({ length: SignUpPasswordMinLength }),
			},
			{
				email: faker.internet.email(),
				password: faker.internet.password({ length: SignUpPasswordMinLength }),
			},
		])
		.execute();
}
