import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { ResetPasswordPrefix } from "../../../src/const/redis.js";
import {
	SignUpPasswordMaxLength,
	SignUpPasswordMinLength,
} from "../../../src/const/zod.js";
import { withTestApp } from "../../testApp.js";

describe("Authentication", () => {
	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({ length: SignUpPasswordMinLength }),
	};

	describe("Reset Password", () => {
		it("Should return 200 status code when request is successful", async () => {
			await withTestApp(async (testApp) => {
				await testApp.createAndVerify({ body: user });
				await testApp.forgotPassword({
					body: { email: user.email },
				});

				const token = (await testApp.app.redis.keys("*"))
					.filter((key) => key.startsWith(ResetPasswordPrefix))
					.at(-1)
					?.split(ResetPasswordPrefix)
					.at(-1);

				const res = await testApp.resetPassword({
					body: {
						token,
						newPassword: faker.internet.password({
							length: SignUpPasswordMinLength,
						}),
					},
				});

				expect(res.statusCode).toBe(200);
			});
		});

		it("Should update password in database", async () => {
			await withTestApp(async (testApp) => {
				await testApp.createAndVerify({ body: user });
				await testApp.forgotPassword({
					body: { email: user.email },
				});

				const currUser = await testApp.app.kysely
					.selectFrom("users")
					.select("password")
					.where("email", "=", user.email.toLowerCase())
					.executeTakeFirst();
				expect(currUser).toBeDefined();

				const token = (await testApp.app.redis.keys("*"))
					.filter((key) => key.startsWith(ResetPasswordPrefix))
					.at(-1)
					?.split(ResetPasswordPrefix)
					.at(-1);

				await testApp.resetPassword({
					body: {
						token,
						newPassword: faker.internet.password({
							length: SignUpPasswordMinLength,
						}),
					},
				});

				const updatedUser = await testApp.app.kysely
					.selectFrom("users")
					.select("password")
					.where("email", "=", user.email.toLowerCase())
					.executeTakeFirst();

				expect(currUser).toBeDefined();
				expect(currUser!.password).not.toEqual(updatedUser!.password);
			});
		});

		it("Should return 400 status code when data is invalid", async () => {
			await withTestApp(async (testApp) => {
				const testCases = [
					{
						token: 1234,
						password: faker.internet.password({
							length: SignUpPasswordMinLength,
						}),
					},
					{
						token: "string",
						password: faker.internet.password({
							length: SignUpPasswordMinLength - 1,
						}),
					},
					{
						token: "string",
						password: faker.internet.password({
							length: SignUpPasswordMaxLength + 1,
						}),
					},
					{
						token: "string",
					},
					{
						password: faker.internet.password({
							length: SignUpPasswordMaxLength + 1,
						}),
					},
					{},
					undefined,
				];

				for (const body of testCases) {
					const res = await testApp.resetPassword({
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
					await testApp.forgotPassword({
						body: { email: body.email },
					});

					await testApp.app.kysely
						.updateTable("users")
						.set(index === 0 ? { isVerified: false } : { isBanned: true })
						.where("email", "=", body.email.toLowerCase())
						.execute();

					const token = (await testApp.app.redis.keys("*"))
						.filter((key) => key.startsWith(ResetPasswordPrefix))
						.at(-1)
						?.split(ResetPasswordPrefix)
						.at(-1);

					const res = await testApp.resetPassword({
						body: {
							token,
							newPassword: faker.internet.password({
								length: SignUpPasswordMinLength,
							}),
						},
					});
					expect(res.statusCode).toBe(400);
				}
			});
		});

		it("Should return 404 status code when user or token not found", async () => {
			await withTestApp(async (testApp) => {
				for (let index = 0; index < 2; index++) {
					await testApp.createAndVerify({ body: user });
					await testApp.forgotPassword({
						body: { email: user.email },
					});

					if (index === 0) {
						await testApp.app.kysely
							.deleteFrom("users")
							.where("email", "=", user.email.toLowerCase())
							.execute();
					}

					const token = (await testApp.app.redis.keys("*"))
						.filter((key) => key.startsWith(ResetPasswordPrefix))
						.at(-1)
						?.split(ResetPasswordPrefix)
						.at(-1);

					const res = await testApp.resetPassword({
						body: {
							token: index === 0 ? token : "Some token",
							newPassword: faker.internet.password({
								length: SignUpPasswordMinLength,
							}),
						},
					});
					expect(res.statusCode).toBe(404);
				}
			});
		});

		it("Should be rate limited", async () => {
			await withTestApp(async (testApp) => {
				for (
					let index = 0;
					index < testApp.app.config.rateLimit.resetPasswordLimit!;
					index++
				) {
					const res = await testApp.resetPassword({
						body: { token: "Invalid token" },
					});

					expect(res.statusCode).toBe(400);
				}

				const lastRes = await testApp.resetPassword({
					body: { token: "Invalid token" },
				});

				expect(lastRes.statusCode).toBe(429);
			});
		});
	});
});
