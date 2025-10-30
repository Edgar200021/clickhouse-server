import {createReadStream} from "node:fs";
import {faker} from "@faker-js/faker";
import type {LightMyRequestResponse} from "fastify";
import formAutoContent from "form-auto-content";
import {describe, expect, it} from "vitest";
import {
	CategoryNameMaxLength,
	CategoryPathMaxLength,
	CategoryPredefinedPathMaxLength,
	SignUpPasswordMinLength,
} from "../../../../src/const/zod.js";
import type {Category} from "../../../../src/types/db/category.js";
import {UserRole} from "../../../../src/types/db/db.js";
import {ImagePath, PdfPath, type TestApp, type WithSignIn, withTestApp,} from "../../../testApp.js";

describe("Admin", () => {
	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({length: SignUpPasswordMinLength}),
	};

	async function setup(testApp: TestApp) {
		return (await testApp.getCategories()).json<{ data: Category[] }>().data;
	}

	describe("Update Category", () => {
		it("Should return 200 status code when request is successful", async () => {
			await withTestApp(async (testApp) => {
				const categories = await setup(testApp);
				const updateCategoryRes = await testApp.withSignIn<
					Parameters<typeof testApp.updateCategory>["1"][],
					WithSignIn<Parameters<typeof testApp.updateCategory>["1"][]>
				>(
					{body: user},
					{
						fn: testApp.updateCategory,
						args: {
							...formAutoContent({name: "newname"}),
						},
						additionalArg: [categories[0].id],
					},
					UserRole.Admin,
				);

				expect(updateCategoryRes.statusCode).toBe(200);
			});
		});

		it("Should change category in database when request is successful", async () => {
			await withTestApp(async (testApp) => {
				const categories = await setup(testApp);
				await testApp.withSignIn<
					Parameters<typeof testApp.updateCategory>["1"][],
					WithSignIn<Parameters<typeof testApp.updateCategory>["1"][]>
				>(
					{body: user},
					{
						fn: testApp.updateCategory,
						args: {
							...formAutoContent({name: "new name"}),
						},
						additionalArg: [categories[0].id],
					},
					UserRole.Admin,
				);

				const dbCategory = await testApp.app.kysely
					.selectFrom("category")
					.selectAll()
					.where("id", "=", categories[0].id)
					.executeTakeFirstOrThrow();

				expect(dbCategory.name !== categories[0].name);
				expect(dbCategory.name === "new name");
			});
		});

		it("Should return 400 status code when data is invalid", async () => {
			await withTestApp(async (testApp) => {
				const categories = await setup(testApp);
				const testCases = [
					{},
					{
						path: "invalid path",
					},
					{
						image: createReadStream(PdfPath),
					},
					{
						name: faker.string.alpha(),
						path: faker.string.alpha(),
						image: "Non file",
					},
					{
						name: faker.string.alpha(),
						image: createReadStream(ImagePath),
						predefinedPath: "invalid path",
						path: faker.string.alpha(),
					},
					{
						name: faker.string.alpha({length: CategoryNameMaxLength + 1}),
					},
					{
						path: faker.string.alpha({length: CategoryPathMaxLength + 1}),
					},
					{
						predefinedPath: faker.string.alpha({
							length: CategoryPredefinedPathMaxLength + 1,
						}),
					},
				];

				const responses = await testApp.withSignIn<
					Parameters<typeof testApp.updateCategory>["1"][],
					WithSignIn<Parameters<typeof testApp.updateCategory>["1"][]>[]
				>(
					{body: user},
					testCases.map((t) => ({
						fn: testApp.updateCategory,
						args: {
							...formAutoContent(t),
						},
						additionalArg: [categories[0].id],
					})),
					UserRole.Admin,
				);

				for (const response of responses as unknown as LightMyRequestResponse[]) {
					expect(response.statusCode).toBe(400);
				}
			});
		});

		it("Should return 400 and 404 status codes when predefinedPath doesn't exists or full path already exists", async () => {
			await withTestApp(async (testApp) => {
				const categories = await setup(testApp);
				const {path: predefinedPath} = categories.find(
					(c) => !c.path.includes("."),
				)!;
				expect(predefinedPath).toBeDefined;

				const childs = categories.filter(
					(c) =>
						c.path.startsWith(predefinedPath) && c.path.split(".").length === 2,
				)!;
				expect(childs.length).greaterThanOrEqual(2);

				const testCases = [
					{
						name: faker.string.alpha(),
						path: faker.string.alpha(),
						predefinedPath: "randompath",
					},
					{
						name: faker.string.alpha(),
						path: childs[1].path.slice(childs[1].path.indexOf(".") + 1),
						predefinedPath,
					},
				];

				const responses = await testApp.withSignIn<
					Parameters<typeof testApp.updateCategory>["1"][],
					WithSignIn<Parameters<typeof testApp.updateCategory>["1"][]>[]
				>(
					{body: user},
					testCases.map((t) => ({
						fn: testApp.updateCategory,
						args: {
							...formAutoContent(t),
						},
						additionalArg: [childs[0].id],
					})),
					UserRole.Admin,
				);

				for (const [index, response] of responses.entries()) {
					expect(response.statusCode).toBe(index === 0 ? 404 : 400);
				}
			});
		});

		it("Should return 401 status code when user is not authorized", async () => {
			await withTestApp(async (testApp) => {
				const createCategoryRes = await testApp.updateCategory({}, 1);

				expect(createCategoryRes.statusCode).toBe(401);
			});
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			await withTestApp(async (testApp) => {
				const categories = await setup(testApp);
				const updateCategoryRes = await testApp.withSignIn<
					Parameters<typeof testApp.updateCategory>["1"][],
					WithSignIn<Parameters<typeof testApp.updateCategory>["1"][]>
				>(
					{body: user},
					{
						fn: testApp.updateCategory,
						args: {
							...formAutoContent({name: "new name"}),
						},
						additionalArg: [categories[0].id],
					},
				);
				expect(updateCategoryRes.statusCode).toBe(403);
			});
		});
	});
});