import { faker } from "@faker-js/faker";
import type { LightMyRequestResponse } from "fastify";
import { describe, expect, it } from "vitest";
import {
	GetProductsMaxLimit,
	SignUpPasswordMinLength,
} from "../../../../src/const/zod.js";
import { UserRole } from "../../../../src/types/db/db.js";
import type { Product } from "../../../../src/types/db/product.js";
import { buildTestApp } from "../../../testApp.js";

describe("Admin", () => {
	let testApp: Awaited<ReturnType<typeof buildTestApp>>;
	let products: Product[];

	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({ length: SignUpPasswordMinLength }),
	};

	beforeEach(async () => {
		testApp = await buildTestApp();
		products = await testApp.app.kysely
			.selectFrom("product")
			.selectAll()
			.execute();
	});

	afterEach(async () => await testApp.close());

	describe("Get Products", () => {
		it("Should return 200 status code when request is successfull", async () => {
			const getProductsResponse = await testApp.withSignIn(
				{ body: user },
				{
					fn: testApp.getProducts,
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
					query: { limit: products.length },
					expectedLength: products.length,
				},
				{
					query: { limit: products.length, isDeleted: false },
					expectedLength: products.filter((p) => !p.isDeleted).length,
				},
				{
					query: { limit: products.length, isDeleted: true },
					expectedLength: products.filter((p) => p.isDeleted).length,
				},
				{
					query: { limit: products.length, page: 2 },
					expectedLength: 0,
				},
				{
					query: { search: products[0].name.slice(0, 4) },
					expectedLength: products.filter(
						(p) =>
							p.name.includes(products[0].name.slice(0, 4)) ||
							p.description.includes(products[0].name.slice(0, 4)) ||
							p.shortDescription.includes(products[0].name.slice(0, 4)),
					).length,
				},
			];

			for (const testCase of testCases) {
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
						fn: testApp.getProducts,
						args: {
							query: testCase.query as unknown as Record<string, string>,
						},
					},
					UserRole.Admin,
				);

				expect(
					getProductsRes.json<{
						status: "success";
						data: { products: Product[]; totalCount: number };
					}>().data.products.length,
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
					limit: GetProductsMaxLimit + 1,
				},
				{
					search: "",
				},
				{
					isDeleted: "invalid value",
				},
			];
			const responses = await testApp.withSignIn(
				{ body: user },
				testCases.map((query) => {
					return {
						fn: testApp.getProducts,
						args: { query: query as unknown as Record<string, string> },
					};
				}),
				UserRole.Admin,
			);
			for (const response of responses as LightMyRequestResponse[])
				expect(response.statusCode).toBe(400);
		});

		it("Should return 401 status code when user is not authorized", async () => {
			const getProductsRes = await testApp.getProducts({});
			expect(getProductsRes.statusCode).toBe(401);
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			const getProductsRes = await testApp.withSignIn(
				{ body: user },
				{
					fn: testApp.getProducts,
				},
			);
			expect(getProductsRes.statusCode).toBe(403);
		});
	});
});
