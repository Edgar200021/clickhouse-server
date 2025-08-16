import { faker } from "@faker-js/faker/locale/ur";
import type { LightMyRequestResponse } from "fastify";
import { describe, expect, it } from "vitest";
import { SignUpPasswordMinLength } from "../../../../src/const/zod.js";
import type { Category } from "../../../../src/types/db/category.js";
import { UserRole } from "../../../../src/types/db/db.js";
import { buildTestApp, type WithSignIn } from "../../../testApp.js";

describe("Admin", () => {
	let testApp: Awaited<ReturnType<typeof buildTestApp>>;
	let categories: Category[];

	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({ length: SignUpPasswordMinLength }),
	};

	beforeEach(async () => {
		testApp = await buildTestApp();
		categories = (await testApp.getCategories()).json<{ data: Category[] }>()
			.data;
	});

	afterEach(async () => {
		await testApp.app.cloudinary.api.delete_all_resources();
		await testApp.close();
	});

	describe("Create Category", () => {
		it("Should return 200 status code when request is successfull", async () => {
			const deleteCategoryRes = await testApp.withSignIn<
				Parameters<typeof testApp.deleteCategory>["1"][],
				WithSignIn<Parameters<typeof testApp.deleteCategory>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.deleteCategory,
					additionalArg: [categories[0].id],
				},
				UserRole.Admin,
			);

			expect(deleteCategoryRes.statusCode).toBe(200);
		});

		it("Should be deleted from database when request is successfull", async () => {
			await testApp.withSignIn<
				Parameters<typeof testApp.deleteCategory>["1"][],
				WithSignIn<Parameters<typeof testApp.deleteCategory>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.deleteCategory,
					additionalArg: [categories[0].id],
				},
			);

			const dbCategory = await testApp.app.kysely
				.selectFrom("category")
				.where("id", "=", categories[0].id)
				.selectAll()
				.execute();

			expect(dbCategory).toBeUndefined;
		});

		it("Should return 400 status code when data is invalid", async () => {
			const deleteCategoryRes = await testApp.withSignIn<
				Parameters<typeof testApp.deleteCategory>["1"][],
				WithSignIn<Parameters<typeof testApp.deleteCategory>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.deleteCategory,
					additionalArg: [
						"invalidid" as unknown as Parameters<
							typeof testApp.deleteCategory
						>["1"],
					],
				},
				UserRole.Admin,
			);

			expect(deleteCategoryRes.statusCode).toBe(400);
		});

		it("Should return 401 status code when user is not authorized", async () => {
			const deleteCategoryRes = await testApp.deleteCategory(
				{},
				categories[0].id,
			);

			expect(deleteCategoryRes.statusCode).toBe(401);
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			const deleteCategoryRes = await testApp.withSignIn<
				Parameters<typeof testApp.deleteCategory>["1"][],
				WithSignIn<Parameters<typeof testApp.deleteCategory>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.deleteCategory,
					additionalArg: [categories[0].id],
				},
			);

			expect(deleteCategoryRes.statusCode).toBe(403);
		});

		it("Should return 404 status code when category doesn't exist", async () => {
			const deleteCategoryRes = await testApp.withSignIn<
				Parameters<typeof testApp.deleteCategory>["1"][],
				WithSignIn<Parameters<typeof testApp.deleteCategory>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.deleteCategory,
					additionalArg: [Math.max(...categories.map((v) => v.id)) + 1],
				},
				UserRole.Admin,
			);

			expect(deleteCategoryRes.statusCode).toBe(404);
		});
	});
});
