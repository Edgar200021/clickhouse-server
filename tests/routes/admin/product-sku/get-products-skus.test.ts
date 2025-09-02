import { faker } from "@faker-js/faker";
import type { LightMyRequestResponse } from "fastify";
import { describe, expect, it } from "vitest";
import {
	GetProductsSkusMaxLimit,
	SignUpPasswordMinLength,
} from "../../../../src/const/zod.js";
import { UserRole } from "../../../../src/types/db/db.js";
import type { Product, ProductSku } from "../../../../src/types/db/product.js";
import { buildTestApp } from "../../../testApp.js";

describe("Admin", () => {
	let testApp: Awaited<ReturnType<typeof buildTestApp>>;
	let productsSkus: (ProductSku & Product)[];

	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({ length: SignUpPasswordMinLength }),
	};

	beforeEach(async () => {
		testApp = await buildTestApp();
		productsSkus = await testApp.app.kysely
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
	});

	afterEach(async () => await testApp.close());

	describe("Get Products Skus", () => {
		it("Should return 200 status code when request is successfull", async () => {
			const getProductsResponse = await testApp.withSignIn(
				{ body: user },
				{
					fn: testApp.getProductsSkus,
				},
				UserRole.Admin,
			);

			expect(getProductsResponse.statusCode).toBe(200);
		});

		it("Should return correct data when filters are valid", async () => {
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
							: productsSkus.filter((pr) => pr.price >= productsSkus[1].price),
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
						fn: testApp.getProductsSkus,
						args: {
							query: testCase.query as unknown as Record<string, string>,
						},
					},
					UserRole.Admin,
				);

				expect(getProductsRes.statusCode).toBe(200);
				expect(
					getProductsRes.json<{
						status: "success";
						data: { productsSkus: ProductSku[]; totalCount: number };
					}>().data.productsSkus.length,
				).toEqual(testCase.expectedLength);
			}
		});

		it("Should return 400 status code when filters are invalid", async () => {
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
			];
			const responses = await testApp.withSignIn(
				{ body: user },
				testCases.map((query) => {
					return {
						fn: testApp.getProductsSkus,
						args: { query: query as unknown as Record<string, string> },
					};
				}),
				UserRole.Admin,
			);
			for (const response of responses as LightMyRequestResponse[])
				expect(response.statusCode).toBe(400);
		});

		it("Should return 401 status code when user is not authorized", async () => {
			const getProductsRes = await testApp.getProductsSkus({});
			expect(getProductsRes.statusCode).toBe(401);
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			const getProductsRes = await testApp.withSignIn(
				{ body: user },
				{
					fn: testApp.getProductsSkus,
				},
			);
			expect(getProductsRes.statusCode).toBe(403);
		});
	});
});
