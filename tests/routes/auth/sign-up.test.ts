import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import {
	SignUpPasswordMaxLength,
	SignUpPasswordMinLength,
} from "../../../src/const/type-box.js";
import { buildTestApp } from "../../testApp.js";

describe("Authentication", () => {
	let testApp: Awaited<ReturnType<typeof buildTestApp>>;
	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({ length: 8 }),
	};

	beforeEach(async () => {
		testApp = await buildTestApp();
	});

	afterEach(async () => {
		await testApp.close();
	});

	describe("Sign Up", () => {
		it("Should return 201 status code when request is successful", async () => {
			const res = await testApp.signUp({ body: user });

			expect(res.statusCode).toBe(201);
		});

		it("Should save user into database when request is successfull", async () => {
			await testApp.signUp({ body: user });

			const dbUser = await testApp.app.kysely
				.selectFrom("users")
				.where("email", "=", user.email)
				.executeTakeFirst();

			expect(dbUser).toBeDefined();
		});

		it("Should return 400 status code when data is invalid", async () => {
			const testCases = [
				{
					email: faker.internet.email(),
					password: faker.internet.password({
						length: SignUpPasswordMinLength - 1,
					}),
				},
				{
					email: faker.internet.email(),
					password: faker.internet.password({
						length: SignUpPasswordMaxLength + 1,
					}),
				},
				{
					password: faker.internet.password({
						length: SignUpPasswordMinLength,
					}),
				},
				{
					email: faker.internet.email(),
				},
				{
					email: faker.string.sample(),
					password: faker.internet.password({
						length: SignUpPasswordMinLength,
					}),
				},
				{},
				undefined,
			];

			const result = await Promise.all(
				testCases.map(
					async (testCase) => await testApp.signUp({ body: testCase }),
				),
			);

			for (const res of result) {
				expect(res.statusCode).toEqual(400);
			}
		});

		it("Should return 400 status code when user already registered", async () => {
			await testApp.signUp({ body: user });
			const res = await testApp.signUp({ body: user });

			expect(res.statusCode).toBe(400);
		});

		it("Should be rate limited", async () => {
			const app = await buildTestApp();

			const res = await Promise.all(
				Array.from({ length: app.app.config.rateLimit.signUpLimit! - 1 }).map(
					async () =>
						await app.signUp({
							body: {
								email: faker.internet.email(),
								password: faker.internet.password({
									length: SignUpPasswordMinLength,
								}),
							},
						}),
				),
			);

			res.every((r) => expect(r.statusCode).toBe(201));
			const lastRes = await app.signUp({
				body: {
					email: faker.internet.email(),
					password: faker.internet.password({
						length: SignUpPasswordMinLength,
					}),
				},
			});

			expect(lastRes.statusCode).toBe(429);
		});
	});
});
