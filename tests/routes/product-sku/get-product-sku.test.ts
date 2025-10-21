import type { LightMyRequestResponse } from "fastify";
import { describe, expect, it } from "vitest";
import type { Product, ProductSku } from "../../../src/types/db/product.js";
import { buildTestApp, type TestApp, withTestApp } from "../../testApp.js";

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

	describe("Get Product Sku", () => {
		it("Should return 200 status code when request is successfull", async () => {
			await withTestApp(async (testApp) => {
				const productsSkus = await setup(testApp);
				const getProductSkuResponse = await testApp.getProductSku(
					{},
					productsSkus[0].id,
				);

				expect(getProductSkuResponse.statusCode).toBe(200);
			});
		});

		it("Should return 400 status code when data is invalid", async () => {
			await withTestApp(async (testApp) => {
				const testCases = ["invalid id", -1];

				const responses = await Promise.all(
					testCases.map(
						async (id) =>
							await testApp.getProductSku({}, id as unknown as number),
					),
				);

				for (const response of responses as unknown as LightMyRequestResponse[])
					expect(response.statusCode).toBe(400);
			});
		});

		it("Should return 404 status code when productSku doesn't exist", async () => {
			await withTestApp(async (testApp) => {
				const productsSkus = await setup(testApp);
				const getProductSkuResponse = await testApp.getProductSku(
					{},
					Math.max(...productsSkus.map((p) => p.id)) + 1,
				);

				expect(getProductSkuResponse.statusCode).toBe(404);
			});
		});

		it("Should be rate limited", async () => {
			await withTestApp(async (testApp) => {
				const productsSkus = await setup(testApp);

				for (
					let i = 0;
					i < testApp.app.config.rateLimit.getProductskuLimit!;
					i++
				) {
					const getProductsSkusRes = await testApp.getProductSku(
						{},
						productsSkus[0].id,
					);

					expect(getProductsSkusRes.statusCode).toBe(200);
				}

				const getProductsSkusLastRes = await testApp.getProductSku(
					{},
					productsSkus[0].id,
				);

				expect(getProductsSkusLastRes.statusCode).toBe(429);
			});
		});
	});
});
