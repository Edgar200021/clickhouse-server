import {faker} from "@faker-js/faker";
import type {LightMyRequestResponse} from "fastify";
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

	describe("Update Product", () => {
		it("Should return 200 status code when request is successful", async () => {
			await withTestApp(async testApp => {
				const products = await setup(testApp)
				const deleteProductRes = await testApp.withSignIn<
					Parameters<typeof testApp.deleteProduct>["1"][],
					WithSignIn<Parameters<typeof testApp.deleteProduct>["1"][]>
				>(
					{body: user},
					{
						fn: testApp.deleteProduct,
						additionalArg: [products[0].id],
					},
					UserRole.Admin,
				);

				expect(deleteProductRes.statusCode).toBe(200);
			})
		});

		it("Should change status is_deleted to true in database when request is successful", async () => {
			await withTestApp(async testApp => {
				const products = await setup(testApp)
				await testApp.withSignIn<
					Parameters<typeof testApp.deleteProduct>["1"][],
					WithSignIn<Parameters<typeof testApp.deleteProduct>["1"][]>
				>(
					{body: user},
					{
						fn: testApp.deleteProduct,
						additionalArg: [products[0].id],
					},
					UserRole.Admin,
				);

				const dbProduct = await testApp.app.kysely
					.selectFrom("product")
					.selectAll()
					.where("id", "=", products[0].id)
					.executeTakeFirstOrThrow();

				expect(dbProduct.isDeleted).toBe(true);
			})
		});

		it("Should return 400 status code when data is invalid", async () => {
			await withTestApp(async testApp => {
				const testCases = ["invalidID", -1];

				const responses = await testApp.withSignIn<
					Parameters<typeof testApp.deleteProduct>["1"][],
					WithSignIn<Parameters<typeof testApp.deleteProduct>["1"][]>[]
				>(
					{body: user},
					testCases.map((t) => ({
						fn: testApp.deleteProduct,
						additionalArg: [t] as Parameters<typeof testApp.deleteProduct>["1"][],
					})),
					UserRole.Admin,
				);

				for (const response of responses as unknown as LightMyRequestResponse[]) {
					expect(response.statusCode).toBe(400);
				}
			})
		});

		it("Should return 401 status code when user is not authorized", async () => {
			await withTestApp(async testApp => {
				const products = await setup(testApp)
				const deleteProductRes = await testApp.deleteProduct({}, products[0].id);
				expect(deleteProductRes.statusCode).toBe(401);
			})
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			await withTestApp(async testApp => {
				const products = await setup(testApp)
				const deleteProductRes = await testApp.withSignIn<
					Parameters<typeof testApp.deleteProduct>["1"][],
					WithSignIn<Parameters<typeof testApp.deleteProduct>["1"][]>
				>(
					{body: user},
					{
						fn: testApp.deleteProduct,
						additionalArg: [products[0].id],
					},
				);
				expect(deleteProductRes.statusCode).toBe(403);
			})
		});
	});
});