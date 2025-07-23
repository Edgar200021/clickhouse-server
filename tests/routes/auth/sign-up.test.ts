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
		password: faker.internet.password({ length: SignUpPasswordMinLength }),
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
				.select(["isVerified", "password"])
				.where("email", "=", user.email)
				.executeTakeFirst();

			expect(dbUser).toBeDefined();
			expect(dbUser?.password).not.toBe(user.password);
			expect(dbUser?.isVerified).toBe(false);
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
			for (let i = 0; i < testApp.app.config.rateLimit.signUpLimit!; i++) {
				const res = await testApp.signUp({
					body: {
						email: faker.internet.email(),
						password: faker.internet.password({
							length: SignUpPasswordMinLength,
						}),
					},
				});
				expect(res.statusCode).toBe(201);
			}

			const lastRes = await testApp.signUp({
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
