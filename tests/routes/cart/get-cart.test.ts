import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { SignUpPasswordMinLength } from "../../../src/const/zod.js";
import { buildTestApp } from "../../testApp.js";

describe("Cart", () => {
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

	describe("Get Cart", () => {
		it("Should return 200 status code when request is successful", async () => {
			const getCartRes = await testApp.withSignIn(
				{ body: user },
				{
					fn: testApp.getCart,
				},
			);
			expect(getCartRes.statusCode).toBe(200);
		});

		it("Should return 401 status code when user is not authorized", async () => {
			const getCartRes = await testApp.getCart();

			expect(getCartRes.statusCode).toBe(401);
		});

		it.only("Should be rate limited", async () => {
			const responses = await Promise.all(
				Array.from({ length: testApp.app.config.rateLimit.getCartLimit! }).map(
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

			console.log("\n\n\n\n\n\n\\n\n", responses, "\n\n\n\n\n\n");

			for (const res of responses) expect(res.statusCode).toBe(200);

			console.log("LAST RES \n\n\n\n\n\n\\n\n", "lAST RES", "\n\n\n\n\n\n");

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
