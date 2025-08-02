import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import {
	SignUpPasswordMaxLength,
	SignUpPasswordMinLength,
} from "../../../src/const/type-box.js";
import { buildTestApp } from "../../testApp.js";

describe("User", () => {
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

	describe("Get Me", () => {
		it("Should return 200 status code when request is successful", async () => {
			const getMeRes = await testApp.withSignIn(
				{ body: user },
				{ fn: testApp.getMe },
			);

			expect(getMeRes.statusCode).toBe(200);
		});

		it("Should be rate limited", async () => {
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
