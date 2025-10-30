import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { SignUpPasswordMinLength } from "../../../src/const/zod.js";
import { buildTestApp, withTestApp } from "../../testApp.js";

describe("Cart", () => {
	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({ length: SignUpPasswordMinLength }),
	};

	describe("Get Cart", () => {
		it("Should return 200 status code when request is successful", async () => {
			await withTestApp(async (testApp) => {
				const getCartRes = await testApp.withSignIn(
					{ body: user },
					{
						fn: testApp.getCart,
					},
				);
				expect(getCartRes.statusCode).toBe(200);
			});
		});

		it("Should return 401 status code when user is not authorized", async () => {
			await withTestApp(async (testApp) => {
				const getCartRes = await testApp.getCart();

				expect(getCartRes.statusCode).toBe(401);
			});
		});

		it("Should be rate limited", async () => {
			await withTestApp(async (testApp) => {
				const responses = await Promise.all(
					Array.from({
						length: testApp.app.config.rateLimit.getCartLimit!,
					}).map(
						async () =>
							await testApp.withSignIn(
								{
									body: {
										email: faker.internet.email(),
										password: faker.internet.password({
											length: SignUpPasswordMinLength,
										}),
									},
								},
								{ fn: testApp.getCart },
							),
					),
				);

				for (const res of responses) expect(res.statusCode).toBe(200);

				const getCartLastRes = await testApp.withSignIn(
					{
						body: user,
					},
					{ fn: testApp.getCart },
				);

				expect(getCartLastRes.statusCode).toBe(429);
			});
		});
	});
});
