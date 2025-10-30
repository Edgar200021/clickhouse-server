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
import {ImagePath, PdfPath, type TestApp, withTestApp,} from "../../../testApp.js";

describe("Admin", () => {
	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({length: SignUpPasswordMinLength}),
	};

	const categoryData = {
		name: faker.string.alpha(),
		path: faker.string.alpha(),
		image: createReadStream(ImagePath),
	};

	async function setup(testApp: TestApp) {
		return (await testApp.getCategories()).json<{ data: Category[] }>().data;
	}

	describe("Create Category", () => {
		it("Should return 201 status code when request is successful", async () => {
			await withTestApp(
				async (testApp) => {
					const createCategoryRes = await testApp.withSignIn(
						{body: user},
						{
							fn: testApp.createCategory,
							args: {
								...formAutoContent(categoryData),
							},
						},
						UserRole.Admin,
					);

					expect(createCategoryRes.statusCode).toBe(201);
				},
				async (testApp) =>
					await testApp.app.cloudinary.api.delete_all_resources(),
			);
		});

		it("Should save category into database when request is successful", async () => {
			await withTestApp(
				async (testApp) => {
					const createCategoryRes = await testApp.withSignIn(
						{body: user},
						{
							fn: testApp.createCategory,
							args: {
								...formAutoContent(categoryData),
							},
						},
						UserRole.Admin,
					);
					expect(createCategoryRes.statusCode).toBe(201);

					const createdCategory = await testApp.app.kysely
						.selectFrom("category")
						.where("path", "=", categoryData.path)
						.executeTakeFirst();

					expect(createdCategory).toBeDefined;
				},
				async (testApp) =>
					await testApp.app.cloudinary.api.delete_all_resources(),
			);
		});

		it("Should return 400 status code when data is invalid", async () => {
			await withTestApp(
				async (testApp) => {
					const testCases = [
						{
							name: faker.string.alpha(),
						},
						{
							path: faker.string.alpha(),
						},
						{
							image: createReadStream(ImagePath),
						},
						{
							name: faker.string.alpha(),
							path: faker.string.alpha(),
						},
						{
							name: faker.string.alpha(),
							image: createReadStream(ImagePath),
						},
						{
							path: faker.string.alpha(),
							image: createReadStream(ImagePath),
						},
						{
							name: faker.string.alpha(),
							path: faker.string.sample(),
							image: createReadStream(ImagePath),
						},
						{
							name: faker.string.alpha(),
							path: faker.string.alphanumeric(),
							image: "Non file",
						},
						{
							name: faker.string.alpha(),
							path: faker.string.alphanumeric(),
							image: createReadStream(PdfPath),
						},
						{
							name: faker.string.alpha(),
							path: faker.string.alpha(),
							image: createReadStream(ImagePath),
							predefinedPath: "invalid path",
						},
						{
							name: faker.string.alpha({length: CategoryNameMaxLength + 1}),
							path: faker.string.alpha(),
							image: createReadStream(ImagePath),
						},
						{
							name: faker.string.alpha(),
							path: faker.string.alpha({length: CategoryPathMaxLength + 1}),
							image: createReadStream(ImagePath),
						},
						{
							name: faker.string.alpha(),
							path: faker.string.alpha(),
							image: createReadStream(ImagePath),
							predefinedPath: faker.string.alpha({
								length: CategoryPredefinedPathMaxLength + 1,
							}),
						},
					];

					const responses = await testApp.withSignIn(
						{body: user},
						testCases.map((t) => ({
							fn: testApp.createCategory,
							args: {
								...formAutoContent(t),
							},
						})),
						UserRole.Admin,
					);

					for (const response of responses as unknown as LightMyRequestResponse[])
						expect(response.statusCode).toBe(400);
				},
				async (testApp) =>
					await testApp.app.cloudinary.api.delete_all_resources(),
			);
		});

		it("Should return 400 and 404 status codes when predefinedPath doesn't exists or full path already exists", async () => {
			await withTestApp(
				async (testApp) => {
					const categories = await setup(testApp);
					const {path: predefinedPath} = categories.find(
						(c) => !c.path.includes("."),
					)!;
					expect(predefinedPath).toBeDefined;

					const lastPart = categories.find(
						(c) =>
							c.path.startsWith(predefinedPath) &&
							c.path.split(".").length === 2,
					)!;
					expect(lastPart).toBeDefined;

					const testCases = [
						{
							name: faker.string.alpha(),
							path: faker.string.alpha(),
							predefinedPath: "randompath",
							image: createReadStream(ImagePath),
						},
						{
							name: faker.string.alpha(),
							path: lastPart.path.slice(lastPart.path.indexOf(".") + 1),
							predefinedPath,
							image: createReadStream(ImagePath),
						},
					];

					const responses = await testApp.withSignIn(
						{body: user},
						testCases.map((t) => ({
							fn: testApp.createCategory,
							args: {
								...formAutoContent(t),
							},
						})),
						UserRole.Admin,
					);

					for (const [index, response] of responses.entries()) {
						expect(response.statusCode).toBe(index === 0 ? 404 : 400);
					}
				},
				async (testApp) =>
					await testApp.app.cloudinary.api.delete_all_resources(),
			);
		});

		it("Should return 401 status code when user is not authorized", async () => {
			await withTestApp(async (testApp) => {
				const createCategoryRes = await testApp.createCategory();

				expect(createCategoryRes.statusCode).toBe(401);
			});
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			await withTestApp(async (testApp) => {
				const createCategoryRes = await testApp.withSignIn(
					{body: user},
					{
						fn: testApp.createCategory,
						args: {
							...formAutoContent(categoryData),
						},
					},
				);

				expect(createCategoryRes.statusCode).toBe(403);
			});
		});
	});
});