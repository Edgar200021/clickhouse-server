import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { SignUpPasswordMinLength } from "../../../src/const/zod.js";
import { withTestApp } from "../../testApp.js";

describe("Authentication", () => {
	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({ length: SignUpPasswordMinLength }),
	};

	describe("Forgot Password", () => {
		it("Should return 200 status code when request is successful", async () => {
			await withTestApp(async (testApp) => {
				await testApp.createAndVerify({ body: user });
				const res = await testApp.forgotPassword({
					body: { email: user.email },
				});

				expect(res.statusCode).toBe(200);
			});
		});

		it("Should return 400 status code when data is invalid", async () => {
			await withTestApp(async (testApp) => {
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
		});

		it("Should return 400 status code when user is not verified or user is banned", async () => {
			await withTestApp(async (testApp) => {
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
		});

		it("Should return 404 status code when user is not found", async () => {
			await withTestApp(async (testApp) => {
				const res = await testApp.forgotPassword({
					body: { email: user.email },
				});

				expect(res.statusCode).toBe(404);
			});
		});

		it("Should be rate limited", async () => {
			await withTestApp(async (testApp) => {
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
});
