import { createReadStream } from "node:fs";
import { faker } from "@faker-js/faker";
import type { LightMyRequestResponse } from "fastify";
import formAutoContent from "form-auto-content";
import {
	ProductDescriptionMaxLength,
	ProductMaterialAndCareMaxLength,
	ProductNameMaxLength,
	ProductShortDescriptionMaxLength,
	SignUpPasswordMinLength,
} from "../../../../src/const/zod.js";
import type { Category } from "../../../../src/types/db/category.js";
import { UserRole } from "../../../../src/types/db/db.js";
import type { Manufacturer } from "../../../../src/types/db/manufacturer.js";
import type { Product } from "../../../../src/types/db/product.js";
import { buildTestApp, ImagePath, PdfPath } from "../../../testApp.js";

describe("Admin", () => {
	let testApp: Awaited<ReturnType<typeof buildTestApp>>;
	let products: Product[];
	let categories: Category[];
	let manufacturers: Manufacturer[];

	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({ length: SignUpPasswordMinLength }),
	};

	const productData = {
		name: faker.string.sample(),
		description: faker.string.sample(),
		shortDescription: faker.string.sample(),
		materialsAndCare: faker.string.sample(),
		categoryId: 1,
		manufacturerId: 1,
	};

	beforeEach(async () => {
		testApp = await buildTestApp();

		const [product, category, manufacture] = await Promise.all([
			testApp.app.kysely.selectFrom("product").selectAll().execute(),
			testApp.app.kysely.selectFrom("category").selectAll().execute(),
			testApp.app.kysely.selectFrom("manufacturer").selectAll().execute(),
		]);

		products = product;
		categories = category;
		manufacturers = manufacture;
	});

	afterEach(async () => {
		await testApp.app.cloudinary.api.delete_all_resources();
		await testApp.close();
	});

	describe("Create Product", () => {
		it("Should return 201 status code when request is successfull", async () => {
			const createProductRes = await testApp.withSignIn(
				{ body: user },
				{
					fn: testApp.createProduct,
					args: {
						...formAutoContent(productData),
					},
				},
				UserRole.Admin,
			);

			expect(createProductRes.statusCode).toBe(201);
		});

		it("Should be saved into database when request is successfull", async () => {
			const createProductRes = await testApp.withSignIn(
				{ body: user },
				{
					fn: testApp.createProduct,
					args: {
						...formAutoContent({
							...productData,
							assemblyInstruction: createReadStream(PdfPath),
						}),
					},
				},
				UserRole.Admin,
			);

			expect(createProductRes.statusCode).toBe(201);

			const dbProduct = await testApp.app.kysely
				.selectFrom("product")
				.selectAll()
				.where("name", "=", productData.name)
				.executeTakeFirstOrThrow();

			expect(dbProduct).toBeDefined();
			expect(dbProduct.id).greaterThan(Math.max(...products.map((p) => p.id)));
			expect(dbProduct.assemblyInstructionFileId).not.toBeNull;
			expect(dbProduct.assemblyInstructionFileUrl).not.toBeNull;
		});

		it("Should return 400 status code when data is missed or invalid", async () => {
			const testCases = [
				{
					description: faker.string.sample(),
					shortDescription: faker.string.sample(),
					materialsAndCare: faker.string.sample(),
					categoryId: 1,
					manufacturerId: 1,
				},
				{
					name: faker.string.sample(),
					shortDescription: faker.string.sample(),
					materialsAndCare: faker.string.sample(),
					categoryId: 1,
					manufacturerId: 1,
				},
				{
					name: faker.string.sample(),
					description: faker.string.sample(),
					materialsAndCare: faker.string.sample(),
					categoryId: 1,
					manufacturerId: 1,
				},
				{
					name: faker.string.sample(),
					description: faker.string.sample(),
					shortDescription: faker.string.sample(),
					categoryId: 1,
					manufacturerId: 1,
				},
				{
					name: faker.string.sample(),
					description: faker.string.sample(),
					shortDescription: faker.string.sample(),
					materialsAndCare: faker.string.sample(),
					manufacturerId: 1,
				},
				{
					name: faker.string.sample(),
					description: faker.string.sample(),
					shortDescription: faker.string.sample(),
					materialsAndCare: faker.string.sample(),
					categoryId: 1,
				},
				{
					name: faker.string.sample(),
					description: faker.string.sample(),
					shortDescription: faker.string.sample(),
					materialsAndCare: faker.string.sample(),
					categoryId: 1,
					manufacturerId: 1,
					assemblyInstruction: createReadStream(ImagePath),
				},
				{
					name: faker.string.sample(),
					description: faker.string.sample(),
					shortDescription: faker.string.sample(),
					materialsAndCare: faker.string.sample(),
					categoryId: "string",
					manufacturerId: 1,
				},
				{
					name: faker.string.sample(),
					description: faker.string.sample(),
					shortDescription: faker.string.sample(),
					materialsAndCare: faker.string.sample(),
					categoryId: 1,
					manufacturerId: "string",
				},
				{
					name: faker.string.alpha({ length: ProductNameMaxLength + 1 }),
					description: faker.string.sample(),
					shortDescription: faker.string.sample(),
					materialsAndCare: faker.string.sample(),
					categoryId: 1,
					manufacturerId: 1,
				},
				{
					name: faker.string.sample(),
					description: faker.string.alpha({
						length: ProductDescriptionMaxLength + 1,
					}),
					shortDescription: faker.string.sample(),
					materialsAndCare: faker.string.sample(),
					categoryId: 1,
					manufacturerId: 1,
				},
				{
					name: faker.string.sample(),
					description: faker.string.sample(),
					shortDescription: faker.string.alpha({
						length: ProductShortDescriptionMaxLength + 1,
					}),
					materialsAndCare: faker.string.sample(),
					categoryId: 1,
					manufacturerId: 1,
				},
				{
					name: faker.string.sample(),
					description: faker.string.sample(),
					shortDescription: faker.string.sample(),
					materialsAndCare: faker.string.alpha({
						length: ProductMaterialAndCareMaxLength + 1,
					}),
					categoryId: 1,
					manufacturerId: 1,
				},
				{
					name: faker.string.sample(),
					description: faker.string.sample(),
					shortDescription: faker.string.sample(),
					materialsAndCare: faker.string.sample(),
					categoryId: 1,
					manufacturerId: 1,
					assemblyInstruction: "Non file",
				},
			];
			const responses = await testApp.withSignIn(
				{ body: user },
				testCases.map((t) => ({
					fn: testApp.createProduct,
					args: {
						...formAutoContent(t),
					},
				})),
				UserRole.Admin,
			);

			for (const response of responses as unknown as LightMyRequestResponse[]) {
				expect(response.statusCode).toBe(400);
			}
		});

		it("Should return 401 status code when user is not authorized", async () => {
			const createProductRes = await testApp.createProduct({});
			expect(createProductRes.statusCode).toBe(401);
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			const createProductRes = await testApp.withSignIn(
				{ body: user },
				{
					fn: testApp.createProduct,
				},
			);
			expect(createProductRes.statusCode).toBe(403);
		});

		it("Should return 404 status code when category or manufacturer is not found", async () => {
			const testCases = [
				{
					name: faker.string.sample(),
					description: faker.string.sample(),
					shortDescription: faker.string.sample(),
					materialsAndCare: faker.string.sample(),
					categoryId: Math.max(...categories.map((c) => c.id)) + 1,
					manufacturerId: 1,
				},
				{
					name: faker.string.sample(),
					description: faker.string.sample(),
					shortDescription: faker.string.sample(),
					materialsAndCare: faker.string.sample(),
					categoryId: 1,
					manufacturerId: Math.max(...manufacturers.map((m) => m.id)) + 1,
				},
			];

			const responses = await testApp.withSignIn(
				{ body: user },
				testCases.map((t) => ({
					fn: testApp.createProduct,
					args: {
						...formAutoContent(t),
					},
				})),
				UserRole.Admin,
			);

			for (const response of responses as unknown as LightMyRequestResponse[]) {
				expect(response.statusCode).toBe(404);
			}
		});
	});
});
