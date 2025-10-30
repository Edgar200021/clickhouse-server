import {createReadStream} from "node:fs";
import {faker} from "@faker-js/faker";
import type {LightMyRequestResponse} from "fastify";
import formAutoContent from "form-auto-content";
import {
	ProductDescriptionMaxLength,
	ProductMaterialAndCareMaxLength,
	ProductNameMaxLength,
	ProductShortDescriptionMaxLength,
	SignUpPasswordMinLength,
} from "../../../../src/const/zod.js";
import {UserRole} from "../../../../src/types/db/db.js";
import {ImagePath, PdfPath, TestApp, withTestApp} from "../../../testApp.js";

describe("Admin", () => {
	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({length: SignUpPasswordMinLength}),
	};

	const productData = {
		name: faker.string.sample(),
		description: faker.string.sample(),
		shortDescription: faker.string.sample(),
		materialsAndCare: faker.string.sample(),
		categoryId: 1,
		manufacturerId: 1,
	};

	async function setup(testApp: TestApp) {
		const [products, categories, manufacturers] = await Promise.all([
			testApp.app.kysely.selectFrom("product").selectAll().execute(),
			testApp.app.kysely.selectFrom("category").selectAll().execute(),
			testApp.app.kysely.selectFrom("manufacturer").selectAll().execute(),
		]);

		return {
			products,
			categories,
			manufacturers
		}
	}


	describe("Create Product", () => {
		it("Should return 201 status code when request is successful", async () => {
			await withTestApp(async testApp => {
				const createProductRes = await testApp.withSignIn(
					{body: user},
					{
						fn: testApp.createProduct,
						args: {
							...formAutoContent(productData),
						},
					},
					UserRole.Admin,
				);

				expect(createProductRes.statusCode).toBe(201);
			}, async testApp => await testApp.app.cloudinary.api.delete_all_resources())
		})
	});

	it("Should be saved into database when request is successful", async () => {
		await withTestApp(async testApp => {
			const {products} = await setup(testApp)
			const createProductRes = await testApp.withSignIn(
				{body: user},
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
		}, async testApp => await testApp.app.cloudinary.api.delete_all_resources())
	});

	it("Should return 400 status code when data is missed or invalid", async () => {
		await withTestApp(async testApp => {
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
					name: faker.string.alpha({length: ProductNameMaxLength + 1}),
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
				{body: user},
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
		}, async testApp => await testApp.app.cloudinary.api.delete_all_resources())
	});

	it("Should return 401 status code when user is not authorized", async () => {
		await withTestApp(async testApp => {
			const createProductRes = await testApp.createProduct({});
			expect(createProductRes.statusCode).toBe(401);
		})
	});

	it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
		await withTestApp(async testApp => {
			const createProductRes = await testApp.withSignIn(
				{body: user},
				{
					fn: testApp.createProduct,
				},
			);
			expect(createProductRes.statusCode).toBe(403);
		})
	});

	it("Should return 404 status code when category or manufacturer is not found", async () => {
		await withTestApp(async testApp => {
			const {categories, manufacturers} = await setup(testApp)
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
				{body: user},
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
		})
	});
});