import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import {
	SignUpPasswordMaxLength,
	SignUpPasswordMinLength,
} from "../../../src/const/zod.js";
import { withTestApp } from "../../testApp.js";

describe("User", () => {
	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({ length: SignUpPasswordMinLength }),
	};

	describe("Get Me", () => {
		it("Should return 200 status code when request is successful", async () => {
			await withTestApp(async (testApp) => {
				const getMeRes = await testApp.withSignIn(
					{ body: user },
					{ fn: testApp.getMe },
				);

				expect(getMeRes.statusCode).toBe(200);
			});
		});

		it("Should return 401 status code when user is not authorized", async () => {
			await withTestApp(async (testApp) => {
				const getMeRes = await testApp.getMe();

				expect(getMeRes.statusCode).toBe(401);
			});
		});

		it("Should be rate limited", async () => {
			await withTestApp(async (testApp) => {
				for (let i = 0; i < testApp.app.config.rateLimit.getMeLimit!; i++) {
					const getMeRes = await testApp.withSignIn(
						{
							body: {
								email: faker.internet.email(),
								password: faker.internet.password({
									length: SignUpPasswordMinLength,
								}),
							},
						},
						{ fn: testApp.getMe },
					);

					expect(getMeRes.statusCode).toBe(200);
				}

				const getMeLastRes = await testApp.withSignIn(
					{
						body: user,
					},
					{ fn: testApp.getMe },
				);

				expect(getMeLastRes.statusCode).toBe(429);
			});
		});
	});
});
