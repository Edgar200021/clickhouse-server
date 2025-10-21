import type { LightMyRequestResponse } from "fastify";
import { describe, expect, it } from "vitest";
import { GetProductsSkusMaxLimit } from "../../../src/const/zod.js";
import type { ProductSku } from "../../../src/types/db/product.js";
import { type TestApp, withTestApp } from "../../testApp.js";

describe("Product Sku", () => {
	const setup = async (testApp: TestApp) => {
		const productsSkus = await testApp.app.kysely
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

		return productsSkus;
	};

	describe("Get All", () => {
		it("Should return 200 status code when request is successfull", async () => {
			await withTestApp(async (testApp) => {
				const getProductsSkusResponse = await testApp.getProductsSkus();

				expect(getProductsSkusResponse.statusCode).toBe(200);
			});
		});

		it("Should return correct data when filters are valid", async () => {
			await withTestApp(async (testApp) => {
				const productsSkus = await setup(testApp);

				const testCases = [
					{
						query: { limit: 5 },
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
						query: { search: productsSkus[0].name.slice(0, 4) },
						expectedLength: productsSkus.filter(
							(p) =>
								p.name.includes(productsSkus[0].name.slice(0, 4)) ||
								p.description.includes(productsSkus[0].name.slice(0, 4)) ||
								p.shortDescription.includes(productsSkus[0].name.slice(0, 4)),
						).length,
					},
					{
						query: { sku: productsSkus[1].sku },
						expectedLength: 1,
					},
					{
						query: {
							limit:
								productsSkus.length > GetProductsSkusMaxLimit
									? GetProductsSkusMaxLimit
									: productsSkus.length,
							minPrice: productsSkus[1].price,
						},
						expectedLength:
							productsSkus.filter((pr) => pr.price >= productsSkus[1].price)
								.length > GetProductsSkusMaxLimit
								? GetProductsSkusMaxLimit
								: productsSkus.filter((pr) => pr.price >= productsSkus[1].price)
										.length,
					},
					{
						query: {
							limit:
								productsSkus.length > GetProductsSkusMaxLimit
									? GetProductsSkusMaxLimit
									: productsSkus.length,
							maxPrice: productsSkus[2].price,
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

				for (const testCase of testCases) {
					const getProductsSkusRes = await testApp.getProductsSkus({
						query: testCase.query as unknown as Record<string, string>,
					});

					expect(getProductsSkusRes.statusCode).toBe(200);
					expect(
						getProductsSkusRes.json<{
							status: "success";
							data: { productsSkus: ProductSku[]; totalCount: number };
						}>().data.productsSkus.length,
						JSON.stringify(testCase),
					).toEqual(testCase.expectedLength);
				}
			});
		});

		it("Should return 400 status code when filters are invalid", async () => {
			await withTestApp(async (testApp) => {
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
				const responses = await Promise.all(
					testCases.map(
						async (query) =>
							await testApp.getProductsSkus({
								query: query as unknown as Record<string, string>,
							}),
					),
				);

				for (const response of responses as unknown as LightMyRequestResponse[])
					expect(response.statusCode).toBe(400);
			});
		});

		it("Should be rate limited", async () => {
			await withTestApp(async (testApp) => {
				for (
					let i = 0;
					i < testApp.app.config.rateLimit.getProductsSkusLimit!;
					i++
				) {
					const getProductsSkusRes = await testApp.getProductsSkus();

					expect(getProductsSkusRes.statusCode).toBe(200);
				}

				const getProductsSkusLastRes = await testApp.getProductsSkus();

				expect(getProductsSkusLastRes.statusCode).toBe(429);
			});
		});
	});
});
