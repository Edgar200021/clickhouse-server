import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { SignUpPasswordMinLength } from "../../../src/const/zod.js";
import { withTestApp } from "../../testApp.js";

describe("Authentication", () => {
	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({ length: SignUpPasswordMinLength }),
	};

	describe("Logout", () => {
		it("Should return 200 status code when request is successful", async () => {
			await withTestApp(async (testApp) => {
				const res = await testApp.withSignIn(
					{ body: user },
					{ fn: testApp.logout },
				);

				expect(res.statusCode).toBe(200);
			});
		});

		it("Should remove cookie when request is successful", async () => {
			await withTestApp(async (testApp) => {
				const res = await testApp.withSignIn(
					{ body: user },
					{ fn: testApp.logout },
				);

				const session = res.cookies.find(
					(c) => c.name === testApp.app.config.application.sessionCookieName,
				);

				expect(session).toBeDefined();
				expect(session?.value).toBe("");
				expect(session?.maxAge).toBe(0);
			});
		});

		it("Should return 401 status code when user is not registered or authorized", async () => {
			await withTestApp(async (testApp) => {
				const res = await testApp.logout();

				expect(res.statusCode).toBe(401);
			});
		});

		it("Should return 401 status code when user already log out", async () => {
			await withTestApp(async (testApp) => {
				await testApp.withSignIn({ body: user }, { fn: testApp.logout });
				const res = await testApp.logout();

				expect(res.statusCode).toBe(401);
			});
		});

		it("Should be rate limited", async () => {
			await withTestApp(async (testApp) => {
				for (let i = 0; i < testApp.app.config.rateLimit.logoutLimit!; i++) {
					const res = await testApp.withSignIn(
						{
							body: {
								email: faker.internet.email(),
								password: faker.internet.password({
									length: SignUpPasswordMinLength,
								}),
							},
						},
						{ fn: testApp.logout },
					);

					expect(res.statusCode).toBe(200);
				}

				const lastRes = await testApp.withSignIn(
					{ body: user },
					{ fn: testApp.logout },
				);

				expect(lastRes.statusCode).toBe(429);
			});
		});
	});
});
