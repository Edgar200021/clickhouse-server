import { describe, expect, it } from "vitest";
import { buildTestApp } from "../../testApp.js";

describe("Category", () => {
	let testApp: Awaited<ReturnType<typeof buildTestApp>>;

	beforeEach(async () => {
		testApp = await buildTestApp();
	});

	afterEach(async () => {
		await testApp.close();
	});

	describe("Get Categories", () => {
		it("Should return 200 status code when request is successful", async () => {
			const categoryRes = await testApp.getCategories();

			expect(categoryRes.statusCode).toBe(200);
		});

		it("Should be rate limited", async () => {
			for (
				let i = 0;
				i < testApp.app.config.rateLimit.getCategoriesLimit!;
				i++
			) {
				const categoryRes = await testApp.getCategories();

				expect(categoryRes.statusCode).toBe(200);
			}

			const categoryRes = await testApp.getCategories();

			expect(categoryRes.statusCode).toBe(429);
		});
	});
});
