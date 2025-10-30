import {faker} from "@faker-js/faker";
import type {LightMyRequestResponse} from "fastify";
import {describe, expect, it} from "vitest";
import {SignUpPasswordMinLength} from "../../../../src/const/zod.js";
import {UserRole} from "../../../../src/types/db/db.js";
import {TestApp, type WithSignIn, withTestApp} from "../../../testApp.js";

describe("Admin", () => {
	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({length: SignUpPasswordMinLength}),
	};

	async function setup(testApp: TestApp) {
		return await testApp.app.kysely
			.selectFrom("product")
			.selectAll()
			.execute()
	}

	describe("Get Products", () => {
		it("Should return 200 status code when request is successful", async () => {
			await withTestApp(async testApp => {
				const products = await setup(testApp)
				const getProductResponse = await testApp.withSignIn<
					Parameters<typeof testApp.getProduct>["1"][],
					WithSignIn<Parameters<typeof testApp.getProduct>["1"][]>
				>(
					{body: user},
					{
						fn: testApp.getProduct,
						additionalArg: [products[0].id],
					},
					UserRole.Admin,
				);

				expect(getProductResponse.statusCode).toBe(200);
			})
		});

		it("Should return 400 status code when data is invalid", async () => {
			await withTestApp(async testApp => {
				const testCases = ["invalid id", -1];
				const responses = await testApp.withSignIn<
					Parameters<typeof testApp.getProduct>["1"][],
					WithSignIn<Parameters<typeof testApp.getProduct>["1"][]>[]
				>(
					{body: user},
					testCases.map((t) => ({
						fn: testApp.getProduct,
						additionalArg: [t] as Parameters<typeof testApp.getProduct>["1"][],
					})),
					UserRole.Admin,
				);
				for (const response of responses as unknown as LightMyRequestResponse[])
					expect(response.statusCode).toBe(400);
			})
		});

		it("Should return 401 status code when user is not authorized", async () => {
			await withTestApp(async testApp => {
				const products = await setup(testApp)
				const getProductResponse = await testApp.getProduct({}, products[0].id);
				expect(getProductResponse.statusCode).toBe(401);
			})
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			await withTestApp(async testApp => {
				const products = await setup(testApp)
				const getProductResponse = await testApp.withSignIn<
					Parameters<typeof testApp.getProduct>["1"][],
					WithSignIn<Parameters<typeof testApp.getProduct>["1"][]>
				>(
					{body: user},
					{
						fn: testApp.getProducts,
						additionalArg: [products[0].id],
					},
				);
				expect(getProductResponse.statusCode).toBe(403);
			})
		});
	});
});