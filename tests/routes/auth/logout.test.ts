import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { SignUpPasswordMinLength } from "../../../src/const/type-box.js";
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

	describe("Logout", () => {
		it("Should return 200 status code when request is successful", async () => {
			const res = await testApp.withSignIn(
				{ body: user },
				{ fn: testApp.logout },
			);

			expect(res.statusCode).toBe(200);
		});

		it("Should remove cookie when request is successful", async () => {
			const res = await testApp.withSignIn(
				{ body: user },
				{ fn: testApp.logout },
			);

			const session = res.cookies.find(
				(c) => c.name === testApp.app.config.application.sessionName,
			);

			expect(session).toBeDefined();
			expect(session?.value).toBe("");
			expect(session?.maxAge).toBe(0);
		});

		it("Should return 401 status code when user is not registered or authorized", async () => {
			const res = await testApp.logout();

			expect(res.statusCode).toBe(401);
		});

		it("Should return 401 status code when user already log out", async () => {
			await testApp.withSignIn({ body: user }, { fn: testApp.logout });
			const res = await testApp.logout();

			expect(res.statusCode).toBe(401);
		});

		it("Should be rate limited", async () => {
			const app = await buildTestApp();

			for (let i = 0; i < app.app.config.rateLimit.logoutLimit!; i++) {
				const res = await app.withSignIn(
					{
						body: {
							email: faker.internet.email(),
							password: faker.internet.password({
								length: SignUpPasswordMinLength,
							}),
						},
					},
					{ fn: app.logout },
				);

				expect(res.statusCode).toBe(200);
			}

			const lastRes = await app.withSignIn({ body: user }, { fn: app.logout });

			expect(lastRes.statusCode).toBe(429);
		});
	});
});
