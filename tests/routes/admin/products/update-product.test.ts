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
import {ImagePath, TestApp, type WithSignIn, withTestApp} from "../../../testApp.js";

describe("Admin", () => {
	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({length: SignUpPasswordMinLength}),
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


	describe("Update Product", () => {
		it("Should return 200 status code when request is successful", async () => {
			await withTestApp(async testApp => {
				const {products} = await setup(testApp)
				const updateProductRes = await testApp.withSignIn<
					Parameters<typeof testApp.updateProduct>["1"][],
					WithSignIn<Parameters<typeof testApp.updateProduct>["1"][]>
				>(
					{body: user},
					{
						fn: testApp.updateProduct,
						args: {
							...formAutoContent({name: faker.string.sample()}),
						},
						additionalArg: [products[0].id],
					},
					UserRole.Admin,
				);

				expect(updateProductRes.statusCode).toBe(200);
			})
		});


		it("Should change product in database when request is successful", async () => {
			await withTestApp(async testApp => {
				const {products} = await setup(testApp)
				await testApp.withSignIn<
					Parameters<typeof testApp.updateProduct>["1"][],
					WithSignIn<Parameters<typeof testApp.updateProduct>["1"][]>
				>(
					{body: user},
					{
						fn: testApp.updateProduct,
						args: {
							...formAutoContent({name: "new name"}),
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
			})
		});

		it("Should return 400 status code when data is invalid", async () => {
			await withTestApp(async testApp => {
				const {products} = await setup(testApp)
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
						name: faker.string.alpha({length: ProductNameMaxLength + 1}),
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
					{body: user},
					testCases.map((t) => ({
						fn: testApp.updateProduct,
						args: {
							...formAutoContent(t),
						},
						additionalArg: [products[0].id],
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
				const {products} = await setup(testApp)
				const updateProductRes = await testApp.updateProduct({}, products[0].id);
				expect(updateProductRes.statusCode).toBe(401);
			})
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			await withTestApp(async testApp => {
				const {products} = await setup(testApp)
				const updateProductRes = await testApp.withSignIn<
					Parameters<typeof testApp.updateCategory>["1"][],
					WithSignIn<Parameters<typeof testApp.updateCategory>["1"][]>
				>(
					{body: user},
					{
						fn: testApp.updateProduct,
						additionalArg: [products[0].id],
					},
				);
				expect(updateProductRes.statusCode).toBe(403);
			})
		});

		it("Should return 404 status code when category or manufacturer is not found", async () => {
			await withTestApp(async testApp => {
				const {categories, manufacturers} = await setup(testApp)
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
					{body: user},
					testCases.map((t) => ({
						fn: testApp.updateProduct,
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
});