import { faker } from "@faker-js/faker";
import { sql } from "kysely";
import { describe, expect, it } from "vitest";
import { VerificationPrefix } from "../../../src/const/redis.js";
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

	afterEach(async () => {
		await testApp.close();
	});

	describe("Account Verification", () => {
		it("Should return 200 status code when request is successful", async () => {
			await testApp.signUp({ body: user });

			const token = (await testApp.app.redis.keys("*"))
				.filter((key) => key.startsWith(VerificationPrefix))
				.at(-1)
				?.split(VerificationPrefix)
				.at(-1);

			const verificationRes = await testApp.accountVerification({
				body: { token },
			});

			expect(verificationRes.statusCode).toBe(200);
		});

		it("Should verify user when request is successful", async () => {
			await testApp.signUp({ body: user });

			const token = (await testApp.app.redis.keys("*"))
				.filter((key) => key.startsWith(VerificationPrefix))
				.at(-1)
				?.split(VerificationPrefix)
				.at(-1);

			await testApp.accountVerification({
				body: { token },
			});

			const dbUser = await testApp.app.kysely
				.selectFrom("users")
				.select("isVerified")
				.where("email", "=", user.email.toLowerCase())
				.executeTakeFirst();

			expect(dbUser?.isVerified).toBe(true);
		});

		it("Should create cart for user when request is successful", async () => {
			await testApp.signUp({ body: user });

			const token = (await testApp.app.redis.keys("*"))
				.filter((key) => key.startsWith(VerificationPrefix))
				.at(-1)
				?.split(VerificationPrefix)
				.at(-1);

			await testApp.accountVerification({
				body: { token },
			});

			const cart = await testApp.app.kysely
				.selectFrom("cart")
				.innerJoin("users", "users.id", "cart.userId")
				.where("users.email", "=", user.email.toLowerCase())
				.selectAll("cart")
				.executeTakeFirst();

			expect(cart).toBeDefined();
		});

		it("Should return 400 status code when data is invalid", async () => {
			const testCases = [
				{
					body: { token: undefined },
				},
				{
					body: { token: 123 },
				},
			];

			const result = await Promise.all(
				testCases.map(
					async (testCase) =>
						await testApp.accountVerification({ body: testCase }),
				),
			);

			for (const res of result) {
				expect(res.statusCode).toEqual(400);
			}
		});

		it("Should return 400 status code when user is already verified or banned", async () => {
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
				await testApp.signUp({ body });
				await testApp.app.kysely
					.updateTable("users")
					.set(index === 0 ? { isVerified: true } : { isBanned: true })
					.where("email", "=", body.email.toLowerCase())
					.execute();

				const token = (await testApp.app.redis.keys("*"))
					.filter((key) => key.startsWith(VerificationPrefix))
					.at(-1)
					?.split(VerificationPrefix)
					.at(-1);
				const res = await testApp.accountVerification({
					body: { token },
				});

				expect(res.statusCode).toBe(400);
			}
		});

		it("Should return 404 status code when token is incorrect", async () => {
			const res = await testApp.accountVerification({
				body: { token: "Some token" },
			});

			expect(res.statusCode).toBe(404);
		});

		it("Should return 404 status code when user doesn't exist", async () => {
			await testApp.signUp({ body: user });
			await testApp.app.kysely
				.deleteFrom("users")
				.where("email", "=", user.email.toLowerCase())
				.execute();

			const token = (await testApp.app.redis.keys("*"))
				.filter((key) => key.startsWith(VerificationPrefix))
				.at(-1)
				?.split(VerificationPrefix)
				.at(-1);

			const res = await testApp.accountVerification({
				body: { token },
			});

			expect(res.statusCode).toBe(404);
		});

		it("Should be rate limited", async () => {
			for (
				let i = 0;
				i < testApp.app.config.rateLimit.accountVerificationLimit!;
				i++
			) {
				const res = await testApp.accountVerification({
					body: {
						token: "Some token",
					},
				});
				expect(res.statusCode).toBe(404);
			}

			const lastRes = await testApp.accountVerification({
				body: {
					token: "Some token",
				},
			});

			expect(lastRes.statusCode).toBe(429);
		});
	});
});
