import {faker} from "@faker-js/faker";
import type {LightMyRequestResponse} from "fastify";
import {describe, expect, it} from "vitest";
import {GetProductsSkusMaxLimit, SignUpPasswordMinLength,} from "../../../../src/const/zod.js";
import {Currency, UserRole} from "../../../../src/types/db/db.js";
import type {ProductSku} from "../../../../src/types/db/product.js";
import {TestApp, withTestApp} from "../../../testApp.js";

describe("Admin", () => {
	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({length: SignUpPasswordMinLength}),
	};

	async function setup(testApp: TestApp) {
		return await testApp.app.kysely
			.selectFrom("productSku")
			.innerJoin("product", "product.id", "productSku.productId")
			.select([
				"product.id as pid",
				"product.createdAt as pcr",
				"product.updatedAt as pup",
				"product.name",
				"product.description",
				"product.shortDescription",
				"product.materialsAndCare",
				"product.isDeleted",
				"product.assemblyInstructionFileId",
				"product.assemblyInstructionFileUrl",
				"product.categoryId",
				"product.manufacturerId",
			])
			.selectAll(["productSku"])
			.execute();
	}

	describe("Get Products Skus", () => {
		it("Should return 200 status code when request is successful", async () => {
			await withTestApp(async testApp => {
				const getProductsResponse = await testApp.withSignIn(
					{body: user},
					{
						fn: testApp.getProductsSkusAdmin,
					},
					UserRole.Admin,
				);

				expect(getProductsResponse.statusCode).toBe(200);
			})
		});

		it("Should return correct data when filters are valid", async () => {
			await withTestApp(async testApp => {
				const productsSkus = await setup(testApp)
				const testCases = [
					{
						query: {limit: 5},
						expectedLength: 5,
					},
					{
						query: {
							limit:
								productsSkus.length > GetProductsSkusMaxLimit
									? GetProductsSkusMaxLimit
									: productsSkus.length,
						},
						expectedLength:
							productsSkus.length > GetProductsSkusMaxLimit
								? GetProductsSkusMaxLimit
								: productsSkus.length,
					},
					{
						query: {
							limit:
								productsSkus.length > GetProductsSkusMaxLimit
									? GetProductsSkusMaxLimit
									: productsSkus.length,
							isDeleted: false,
						},
						expectedLength:
							productsSkus.filter((p) => !p.isDeleted).length >
							GetProductsSkusMaxLimit
								? GetProductsSkusMaxLimit
								: productsSkus.filter((p) => !p.isDeleted).length,
					},
					{
						query: {
							limit:
								productsSkus.length > GetProductsSkusMaxLimit
									? GetProductsSkusMaxLimit
									: productsSkus.length,
							isDeleted: true,
						},
						expectedLength:
							productsSkus.filter((p) => p.isDeleted).length >
							GetProductsSkusMaxLimit
								? GetProductsSkusMaxLimit
								: productsSkus.filter((p) => p.isDeleted).length,
					},
					{
						query: {search: productsSkus[0].name.slice(0, 4)},
						expectedLength: productsSkus.filter(
							(p) =>
								p.name.includes(productsSkus[0].name.slice(0, 4)) ||
								p.description.includes(productsSkus[0].name.slice(0, 4)) ||
								p.shortDescription.includes(productsSkus[0].name.slice(0, 4)),
						).length,
					},
					{
						query: {sku: productsSkus[1].sku},
						expectedLength: 1,
					},
					{
						query: {
							limit:
								productsSkus.length > GetProductsSkusMaxLimit
									? GetProductsSkusMaxLimit
									: productsSkus.length,
							minPrice: testApp.app.priceService.transformPrice(productsSkus[1].price, Currency.Rub, "read"),
						},
						expectedLength:
							productsSkus.filter((pr) => pr.price >= productsSkus[1].price)
								.length > GetProductsSkusMaxLimit
								? GetProductsSkusMaxLimit
								: productsSkus.filter((pr) => pr.price >= productsSkus[1].price).length,
					},
					{
						query: {
							limit:
								productsSkus.length > GetProductsSkusMaxLimit
									? GetProductsSkusMaxLimit
									: productsSkus.length,
							maxPrice: testApp.app.priceService.transformPrice(productsSkus[2].price, Currency.Rub, "read"),
						},
						expectedLength:
							productsSkus.filter((pr) => pr.price <= productsSkus[2].price)
								.length > GetProductsSkusMaxLimit
								? GetProductsSkusMaxLimit
								: productsSkus.filter((pr) => pr.price <= productsSkus[2].price)
									.length,
					},
					{
						query: {
							limit:
								productsSkus.length > GetProductsSkusMaxLimit
									? GetProductsSkusMaxLimit
									: productsSkus.length,
							withDiscount: true,
						},
						expectedLength:
							productsSkus.filter((pr) => pr.salePrice !== null).length >
							GetProductsSkusMaxLimit
								? GetProductsSkusMaxLimit
								: productsSkus.filter((pr) => pr.salePrice !== null).length,
					},
					{
						query: {
							limit:
								productsSkus.length > GetProductsSkusMaxLimit
									? GetProductsSkusMaxLimit
									: productsSkus.length,
							withDiscount: false,
						},
						expectedLength:
							productsSkus.filter((pr) => pr.salePrice === null).length >
							GetProductsSkusMaxLimit
								? GetProductsSkusMaxLimit
								: productsSkus.filter((pr) => pr.salePrice === null).length,
					},
					{
						query: {
							limit:
								productsSkus.length > GetProductsSkusMaxLimit
									? GetProductsSkusMaxLimit
									: productsSkus.length,
							inStock: true,
						},
						expectedLength:
							productsSkus.filter((pr) => pr.quantity > 0).length >
							GetProductsSkusMaxLimit
								? GetProductsSkusMaxLimit
								: productsSkus.filter((pr) => pr.quantity > 0).length,
					},
					{
						query: {
							limit:
								productsSkus.length > GetProductsSkusMaxLimit
									? GetProductsSkusMaxLimit
									: productsSkus.length,
							inStock: false,
						},
						expectedLength:
							productsSkus.filter((pr) => pr.quantity === 0).length >
							GetProductsSkusMaxLimit
								? GetProductsSkusMaxLimit
								: productsSkus.filter((pr) => pr.quantity === 0).length,
					},
					{
						query: {
							minPrice: Math.max(...productsSkus.map((p) => p.price)) + 1,
						},
						expectedLength: 0,
					},
				];

				for (const [index, testCase] of testCases.entries()) {
					const getProductsRes = await testApp.withSignIn(
						{
							body: {
								email: faker.internet.email(),
								password: faker.internet.password({
									length: SignUpPasswordMinLength,
								}),
							},
						},
						{
							fn: testApp.getProductsSkusAdmin,
							args: {
								query: testCase.query as unknown as Record<string, string>,
							},
						},
						UserRole.Admin,
					);

					if (testCase.expectedLength !== getProductsRes.json().data.productsSkus.length) {
						console.log("\n\n\n\n\n", index, "\n\n\n\n")
						console.log("\n\n\n\n\n", testCase.query, "\n\n\n\n")
						console.log(productsSkus[0])
					}


					expect(getProductsRes.statusCode, JSON.stringify(testCase.query)).toBe(200);
					expect(
						getProductsRes.json<{
							status: "success";
							data: { productsSkus: ProductSku[]; pageCount: number };
						}>().data.productsSkus.length,
					).toEqual(testCase.expectedLength);
				}
			})
		});

		it("Should return 400 status code when filters are invalid", async () => {
			await withTestApp(async testApp => {
				const testCases = [
					{
						limit: 0,
					},
					{
						page: 0,
					},
					{
						limit: -1,
					},
					{
						page: -1,
					},
					{
						limit: GetProductsSkusMaxLimit + 1,
					},
					{
						search: "",
					},
					{
						isDeleted: "invalid value",
					},
					{
						minPrice: "invalid price",
					},
					{
						maxPrice: "invalid price",
					},
					{
						minPrice: 100,
						maxPrice: 50,
					},
					{
						withDiscount: "invalid value",
					},
					{
						inStock: "Invalid value",
					},
				];
				const responses = await testApp.withSignIn(
					{body: user},
					testCases.map((query) => {
						return {
							fn: testApp.getProductsSkusAdmin,
							args: {query: query as unknown as Record<string, string>},
						};
					}),
					UserRole.Admin,
				);
				for (const response of responses as unknown as LightMyRequestResponse[])
					expect(response.statusCode).toBe(400);

			})
		});

		it("Should return 401 status code when user is not authorized", async () => {
			await withTestApp(async testApp => {
				const getProductsRes = await testApp.getProductsSkusAdmin({});
				expect(getProductsRes.statusCode).toBe(401);
			})
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			await withTestApp(async testApp => {
				const getProductsRes = await testApp.withSignIn(
					{body: user},
					{
						fn: testApp.getProductsSkusAdmin,
					},
				);
				expect(getProductsRes.statusCode).toBe(403);
			})
		});
	});
});