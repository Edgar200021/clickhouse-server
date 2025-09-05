import { faker } from "@faker-js/faker";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SignUpPasswordMinLength } from "../../../src/const/zod.js";
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

	afterEach(async () => await testApp.close());

	describe("Forgot Password", () => {
		it("Should return 200 status code when request is successful", async () => {
			await testApp.createAndVerify({ body: user });
			const res = await testApp.forgotPassword({
				body: { email: user.email },
			});

			expect(res.statusCode).toBe(200);
		});

		it("Should return 400 status code when data is invalid", async () => {
			const testCases = [
				{
					email: 1223,
				},
				{
					email: "invali email",
				},
				{},
				undefined,
			];

			for (const body of testCases) {
				const res = await testApp.forgotPassword({
					body,
				});

				expect(res.statusCode).toBe(400);
			}
		});

		it("Should return 400 status code when user is not verified or user is banned", async () => {
			const testCases = [
				user,
				{
					email: faker.internet.email(),
					password: faker.internet.password({
						length: SignUpPasswordMinLength,
					}),
				},
			];

			for (const [index, body] of testCases.entries()) {
				await testApp.createAndVerify({ body });

				await testApp.app.kysely
					.updateTable("users")
					.set(index === 0 ? { isVerified: false } : { isBanned: true })
					.where("email", "=", body.email.toLowerCase())
					.execute();

				const res = await testApp.forgotPassword({
					body,
				});

				expect(res.statusCode).toBe(400);
			}
		});

		it("Should return 404 status code when user is not found", async () => {
			const res = await testApp.forgotPassword({
				body: { email: user.email },
			});

			expect(res.statusCode).toBe(404);
		});

		it("Should be rate limited", async () => {
			for (
				let index = 0;
				index < testApp.app.config.rateLimit.forgotPasswordLimit!;
				index++
			) {
				const res = await testApp.forgotPassword({
					body: { email: "Invalid email" },
				});

				expect(res.statusCode).toBe(400);
			}

			const lastRes = await testApp.forgotPassword({
				body: { email: "Invalid email" },
			});

			expect(lastRes.statusCode).toBe(429);
		});
	});
});
