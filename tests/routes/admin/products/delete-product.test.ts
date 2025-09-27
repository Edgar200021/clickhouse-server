import { faker } from "@faker-js/faker";
import type { LightMyRequestResponse } from "fastify";
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

	afterEach(async () => {
		await testApp.close();
	});

	describe("Update Product", () => {
		it("Should return 200 status code when request is successfull", async () => {
			const deleteProductRes = await testApp.withSignIn<
				Parameters<typeof testApp.deleteProduct>["1"][],
				WithSignIn<Parameters<typeof testApp.deleteProduct>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.deleteProduct,
					additionalArg: [products[0].id],
				},
				UserRole.Admin,
			);

			expect(deleteProductRes.statusCode).toBe(200);
		});

		it("Should change status is_deleted to true in database when request is successfull", async () => {
			await testApp.withSignIn<
				Parameters<typeof testApp.deleteProduct>["1"][],
				WithSignIn<Parameters<typeof testApp.deleteProduct>["1"][]>
			>(
				{ body: user },
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
		});

		it("Should return 400 status code when data is invalid", async () => {
			const testCases = ["invalidID", -1];

			const responses = await testApp.withSignIn<
				Parameters<typeof testApp.deleteProduct>["1"][],
				WithSignIn<Parameters<typeof testApp.deleteProduct>["1"][]>[]
			>(
				{ body: user },
				testCases.map((t) => ({
					fn: testApp.deleteProduct,
					additionalArg: [t] as Parameters<typeof testApp.deleteProduct>["1"][],
				})),
				UserRole.Admin,
			);

			for (const response of responses as unknown as LightMyRequestResponse[]) {
				expect(response.statusCode).toBe(400);
			}
		});

		it("Should return 401 status code when user is not authorized", async () => {
			const deleteProductRes = await testApp.deleteProduct({}, products[0].id);
			expect(deleteProductRes.statusCode).toBe(401);
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			const deleteProductRes = await testApp.withSignIn<
				Parameters<typeof testApp.deleteProduct>["1"][],
				WithSignIn<Parameters<typeof testApp.deleteProduct>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.deleteProduct,
					additionalArg: [products[0].id],
				},
			);
			expect(deleteProductRes.statusCode).toBe(403);
		});
	});
});
