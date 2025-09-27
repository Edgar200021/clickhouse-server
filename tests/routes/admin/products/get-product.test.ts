import { faker } from "@faker-js/faker";
import type { LightMyRequestResponse } from "fastify";
import { describe, expect, it } from "vitest";
import { SignUpPasswordMinLength } from "../../../../src/const/zod.js";
import { UserRole } from "../../../../src/types/db/db.js";
import type { Product } from "../../../../src/types/db/product.js";
import { buildTestApp, type WithSignIn } from "../../../testApp.js";

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
			const getProductResponse = await testApp.withSignIn<
				Parameters<typeof testApp.getProduct>["1"][],
				WithSignIn<Parameters<typeof testApp.getProduct>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.getProduct,
					additionalArg: [products[0].id],
				},
				UserRole.Admin,
			);

			expect(getProductResponse.statusCode).toBe(200);
		});

		it("Should return 400 status code when data is invalid", async () => {
			const testCases = ["invalid id", -1];
			const responses = await testApp.withSignIn<
				Parameters<typeof testApp.getProduct>["1"][],
				WithSignIn<Parameters<typeof testApp.getProduct>["1"][]>[]
			>(
				{ body: user },
				testCases.map((t) => ({
					fn: testApp.getProduct,
					additionalArg: [t] as Parameters<typeof testApp.getProduct>["1"][],
				})),
				UserRole.Admin,
			);
			for (const response of responses as unknown as LightMyRequestResponse[])
				expect(response.statusCode).toBe(400);
		});

		it("Should return 401 status code when user is not authorized", async () => {
			const getProductResponse = await testApp.getProduct({}, products[0].id);
			expect(getProductResponse.statusCode).toBe(401);
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			const getProductResponse = await testApp.withSignIn<
				Parameters<typeof testApp.getProduct>["1"][],
				WithSignIn<Parameters<typeof testApp.getProduct>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.getProducts,
					additionalArg: [products[0].id],
				},
			);
			expect(getProductResponse.statusCode).toBe(403);
		});
	});
});
