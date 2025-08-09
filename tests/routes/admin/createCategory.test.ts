import { createReadStream } from "node:fs";
import { faker } from "@faker-js/faker/locale/ur";
import formAutoContent from "form-auto-content";
import { describe, expect, it } from "vitest";
import { SignUpPasswordMinLength } from "../../../src/const/zod.js";
import type { Category } from "../../../src/types/db/category.js";
import { UserRole } from "../../../src/types/db/db.js";
import { buildTestApp, ImagePath, PdfPath } from "../../testApp.js";

describe("Admin", () => {
	let testApp: Awaited<ReturnType<typeof buildTestApp>>;
	let categories: Category[];

	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({ length: SignUpPasswordMinLength }),
	};

	const categoryData = {
		name: faker.string.alpha(),
		path: faker.string.alpha(),
		file: createReadStream(ImagePath),
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
		it("Should return 201 status code when request is successfull", async () => {
			const createCategoryRes = await testApp.withSignIn(
				{ body: user },
				{
					fn: testApp.createCategory,
					args: {
						...formAutoContent(categoryData),
					},
				},
				UserRole.Admin,
			);

			expect(createCategoryRes.statusCode).toBe(201);
		});

		it("Should save category into database when request is successfull", async () => {
			const createCategoryRes = await testApp.withSignIn(
				{ body: user },
				{
					fn: testApp.createCategory,
					args: {
						...formAutoContent(categoryData),
					},
				},
				UserRole.Admin,
			);
			const createdCategory = await testApp.app.kysely
				.selectFrom("category")
				.where("path", "=", categoryData.path)
				.executeTakeFirst();

			expect(createdCategory).toBeDefined;
		});

		it("Should return 400 status code when data is invalid", async () => {
			const testCases = [
				{
					name: faker.string.alpha(),
				},
				{
					path: faker.string.alpha(),
				},
				{
					file: createReadStream(ImagePath),
				},
				{
					name: faker.string.alpha(),
					path: faker.string.alpha(),
				},
				{
					name: faker.string.alpha(),
					file: createReadStream(ImagePath),
				},
				{
					path: faker.string.alpha(),
					file: createReadStream(ImagePath),
				},
				{
					name: faker.string.alpha(),
					path: faker.string.sample(),
					file: createReadStream(ImagePath),
				},
				{
					name: faker.string.alpha(),
					path: faker.string.alphanumeric(),
					file: "Non file",
				},
				{
					name: faker.string.alpha(),
					path: faker.string.alphanumeric(),
					file: createReadStream(PdfPath),
				},
				{
					name: faker.string.alpha(),
					path: faker.string.alpha(),
					file: createReadStream(ImagePath),
					predefinedPath: "invalid path",
				},
			];

			const responses = await testApp.withSignIn(
				{ body: user },
				testCases.map((t) => ({
					fn: testApp.createCategory,
					args: {
						...formAutoContent(t),
					},
				})),
				UserRole.Admin,
			);

			for (const response of responses) {
				expect(response.statusCode).toBe(400);
			}
		});

		it("Should return 400 and 404 status codes when predefinedPath doesn't exists or full path already exists", async () => {
			const { path: predefinedPath } = categories.find(
				(c) => !c.path.includes("."),
			)!;
			expect(predefinedPath).toBeDefined;

			const lastPart = categories.find(
				(c) =>
					c.path.startsWith(predefinedPath) && c.path.split(".").length === 2,
			)!;
			expect(lastPart).toBeDefined;

			const testCases = [
				{
					name: faker.string.alpha(),
					path: faker.string.alpha(),
					predefinedPath: "randompath",
					file: createReadStream(ImagePath),
				},
				{
					name: faker.string.alpha(),
					path: lastPart.path.slice(lastPart.path.indexOf(".") + 1),
					predefinedPath,
					file: createReadStream(ImagePath),
				},
			];

			const responses = await testApp.withSignIn(
				{ body: user },
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
		});

		it("Should return 401 status code when user is not authorized", async () => {
			const createCategoryRes = await testApp.createCategory();

			expect(createCategoryRes.statusCode).toBe(401);
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			const createCategoryRes = await testApp.withSignIn(
				{ body: user },
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
