import { faker } from "@faker-js/faker";
import type { LightMyRequestResponse } from "fastify";
import { describe, expect, it } from "vitest";
import { SignUpPasswordMinLength } from "../../../../src/const/zod.js";
import { UserRole } from "../../../../src/types/db/db.js";
import type { Product, ProductSku } from "../../../../src/types/db/product.js";
import { buildTestApp, type WithSignIn } from "../../../testApp.js";

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

	describe("Get Product Sku", () => {
		it("Should return 200 status code when request is successfull", async () => {
			const getProductSkuResponse = await testApp.withSignIn<
				Parameters<typeof testApp.getProductSkuAdmin>["1"][],
				WithSignIn<Parameters<typeof testApp.getProductSkuAdmin>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.getProductSkuAdmin,
					additionalArg: [productsSkus[0].id],
				},
				UserRole.Admin,
			);

			expect(getProductSkuResponse.statusCode).toBe(200);
		});

		it("Should return 400 status code when data is invalid", async () => {
			const testCases = ["invalid id", -1];
			const responses = await testApp.withSignIn<
				Parameters<typeof testApp.getProductSkuAdmin>["1"][],
				WithSignIn<Parameters<typeof testApp.getProductSkuAdmin>["1"][]>[]
			>(
				{ body: user },
				testCases.map((t) => ({
					fn: testApp.getProductSkuAdmin,
					additionalArg: [t] as Parameters<
						typeof testApp.getProductSkuAdmin
					>["1"][],
				})),
				UserRole.Admin,
			);
			for (const response of responses as unknown as LightMyRequestResponse[])
				expect(response.statusCode).toBe(400);
		});

		it("Should return 401 status code when user is not authorized", async () => {
			const getProductSkuResponse = await testApp.getProductSkuAdmin(
				{},
				productsSkus[0].id,
			);
			expect(getProductSkuResponse.statusCode).toBe(401);
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			const getProductSkuResponse = await testApp.withSignIn<
				Parameters<typeof testApp.getProductSkuAdmin>["1"][],
				WithSignIn<Parameters<typeof testApp.getProductSkuAdmin>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.getProductSkuAdmin,
					additionalArg: [productsSkus[0].id],
				},
			);
			expect(getProductSkuResponse.statusCode).toBe(403);
		});

		it("Should return 404 status code when productSku doesn't exist", async () => {
			const getProductSkuResponse = await testApp.withSignIn<
				Parameters<typeof testApp.getProductSkuAdmin>["1"][],
				WithSignIn<Parameters<typeof testApp.getProductSkuAdmin>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.getProductSkuAdmin,
					additionalArg: [Math.max(...productsSkus.map((p) => p.id)) + 1],
				},
				UserRole.Admin,
			);

			expect(getProductSkuResponse.statusCode).toBe(404);
		});
	});
});
