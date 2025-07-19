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

	describe("Sign in", () => {
		it("Should return 201 status code when request is successful", async () => {
			await testApp.createAndVerify({ body: user });
			const signInRes = await testApp.signIn({ body: user });

			expect(signInRes.statusCode).toBe(200);
		});

		it("Should set cookie when request is successful", async () => {
			await testApp.createAndVerify({ body: user });
			const signInRes = await testApp.signIn({ body: user });

			const cookie = signInRes.cookies.find(
				(cookie) => cookie.name === testApp.app.config.application.sessionName,
			);

			expect(cookie).toBeDefined();
			expect(cookie?.maxAge).toEqual(
				testApp.app.config.application.sessionTTLMinutes * 60,
			);
		});

		it("Should return 400 status code when data is invalid", async () => {
			const testCases = [
				{
					email: faker.internet.email(),
				},
				{
					password: faker.internet.password({
						length: SignUpPasswordMinLength,
					}),
				},
				{},
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
					email: "invalid email",
				},

				{
					password: faker.internet.password({
						length: SignUpPasswordMinLength,
					}),
					email: 1231234,
				},
			];

			for (const body of testCases) {
				const signInRes = await testApp.signIn({ body });

				expect(signInRes.statusCode).toBe(400);
			}
		});

		it("Should return 400 status code when user is not found or banned or not verified", async () => {
			for (let i = 0; i < 3; i++) {
				await testApp.createAndVerify({ body: user });

				if (i === 0 || i === 1) {
					await testApp.app.kysely
						.updateTable("users")
						.set({
							...(i === 0 ? { isBanned: true } : { isVerified: false }),
						})
						.execute();
				}
				const signInRes = await testApp.signIn({
					body:
						i === 0 || i === 1 ? user : { ...user, email: "another@gmail.com" },
				});

				expect(signInRes.statusCode).toBe(400);
			}
		});

		it("Should be rate limited", async () => {
			const app = await buildTestApp();

			for (let i = 0; i < app.app.config.rateLimit.signInLimit!; i++) {
				const res = await app.signIn({
					body: user,
				});

				expect(res.statusCode).toBe(400);
			}

			const lastRes = await app.signIn({
				body: user,
			});

			expect(lastRes.statusCode).toBe(429);
		});
	});
});
