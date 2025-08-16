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
import {
	buildTestApp,
	ImagePath,
	PdfPath,
	type WithSignIn,
} from "../../../testApp.js";

describe("Admin", () => {
	let testApp: Awaited<ReturnType<typeof buildTestApp>>;
	let products: Product[];
	let categories: Category[];
	let manufacturers: Manufacturer[];

	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({ length: SignUpPasswordMinLength }),
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

	describe("Update Product", () => {
		it("Should return 200 status code when request is successfull", async () => {
			const getProductsResponse = await testApp.withSignIn<
				Parameters<typeof testApp.updateProduct>["1"][],
				WithSignIn<Parameters<typeof testApp.updateProduct>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.updateProduct,
					args: {
						...formAutoContent({ name: faker.string.sample() }),
					},
					additionalArg: [products[0].id],
				},
				UserRole.Admin,
			);

			expect(getProductsResponse.statusCode).toBe(200);
		});

		it("Should change product in database when request is successfull", async () => {
			await testApp.withSignIn<
				Parameters<typeof testApp.updateProduct>["1"][],
				WithSignIn<Parameters<typeof testApp.updateProduct>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.updateProduct,
					args: {
						...formAutoContent({ name: "new name" }),
					},
					additionalArg: [products[0].id],
				},
				UserRole.Admin,
			);

			const dbProduct = await testApp.app.kysely
				.selectFrom("product")
				.selectAll()
				.where("id", "=", products[0].id)
				.executeTakeFirstOrThrow();

			expect(dbProduct.name !== products[0].name);
			expect(dbProduct.name === "new name");
		});

		it("Should return 400 status code when data is invalid", async () => {
			const testCases = [
				{},
				{
					categoryId: "string",
				},
				{
					manufacturerId: "string",
				},
				{
					assemblyInstruction: createReadStream(ImagePath),
				},
				{
					assemblyInstruction: "Non file",
				},
				{
					name: faker.string.alpha({ length: ProductNameMaxLength + 1 }),
				},
				{
					description: faker.string.alpha({
						length: ProductDescriptionMaxLength + 1,
					}),
				},
				{
					shortDescription: faker.string.alpha({
						length: ProductShortDescriptionMaxLength + 1,
					}),
				},
				{
					materialsAndCare: faker.string.alpha({
						length: ProductMaterialAndCareMaxLength + 1,
					}),
				},
			];

			const responses = await testApp.withSignIn<
				Parameters<typeof testApp.updateProduct>["1"][],
				WithSignIn<Parameters<typeof testApp.updateProduct>["1"][]>[]
			>(
				{ body: user },
				testCases.map((t) => ({
					fn: testApp.updateProduct,
					args: {
						...formAutoContent(t),
					},
					additionalArg: [products[0].id],
				})),
				UserRole.Admin,
			);

			for (const response of responses as LightMyRequestResponse[]) {
				expect(response.statusCode).toBe(400);
			}
		});

		it("Should return 401 status code when user is not authorized", async () => {
			const getManufacturerRes = await testApp.updateProduct(
				{},
				products[0].id,
			);
			expect(getManufacturerRes.statusCode).toBe(401);
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			const getManufacturerRes = await testApp.withSignIn<
				Parameters<typeof testApp.updateCategory>["1"][],
				WithSignIn<Parameters<typeof testApp.updateCategory>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.updateProduct,
					additionalArg: [products[0].id],
				},
			);
			expect(getManufacturerRes.statusCode).toBe(403);
		});

		it("Should return 404 status code when category or manufacturer is not found", async () => {
			const testCases = [
				{
					categoryId: Math.max(...categories.map((c) => c.id)) + 1,
				},
				{
					manufacturerId: Math.max(...manufacturers.map((m) => m.id)) + 1,
				},
			];

			const responses = await testApp.withSignIn<
				Parameters<typeof testApp.updateProduct>["1"][],
				WithSignIn<Parameters<typeof testApp.updateProduct>["1"][]>[]
			>(
				{ body: user },
				testCases.map((t) => ({
					fn: testApp.updateProduct,
					args: {
						...formAutoContent(t),
					},
				})),
				UserRole.Admin,
			);

			for (const response of responses as LightMyRequestResponse[]) {
				expect(response.statusCode).toBe(404);
			}
		});
	});
});
