import { faker } from "@faker-js/faker";
import type { LightMyRequestResponse } from "fastify";
import { describe, expect, it } from "vitest";
import { MaxCartItemCount } from "../../../src/const/const.js";
import {
	CartItemMaxQuantityPerProduct,
	SignUpPasswordMinLength,
} from "../../../src/const/zod.js";
import { type TestApp, withTestApp } from "../../testApp.js";

describe("Cart", () => {
	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({ length: SignUpPasswordMinLength }),
	};

	async function setup(testApp: TestApp) {
		const productsSkus = await testApp.app.kysely
			.selectFrom("productSku")
			.select(["id"])
			.execute();

		return productsSkus;
	}

	describe("Add Cart Item", () => {
		it("Should return 201 status code when request is successful", async () => {
			await withTestApp(async (testApp) => {
				const productsSkusIds = await setup(testApp);
				const addCartItemRes = await testApp.withSignIn(
					{ body: user },
					{
						fn: testApp.addCartItem,
						args: {
							body: {
								productSkuId: productsSkusIds[0].id,
								quantity: 5,
							},
						},
					},
				);
				expect(addCartItemRes.statusCode).toBe(201);
			});
		});

		it("Should save into database when request is successful", async () => {
			await withTestApp(async (testApp) => {
				const productsSkusIds = await setup(testApp);
				const addCartItemRes = await testApp.withSignIn(
					{ body: user },
					{
						fn: testApp.addCartItem,
						args: {
							body: {
								productSkuId: productsSkusIds[0].id,
								quantity: 5,
							},
						},
					},
				);
				expect(addCartItemRes.statusCode).toBe(201);

				const cartItem = await testApp.app.kysely
					.selectFrom("cartItem")
					.selectAll()
					.innerJoin("cart", "cart.id", "cartItem.cartId")
					.innerJoin("users", "users.id", "cart.userId")
					.where("users.email", "=", user.email.toLowerCase())
					.where("productSkuId", "=", productsSkusIds[0].id)
					.executeTakeFirst();

				expect(cartItem).toBeDefined();
				expect(cartItem?.quantity).toBe(5);
			});
		});

		it("Should update quantity when adding the same productSku again", async () => {
			await withTestApp(async (testApp) => {
				const productsSkusIds = await setup(testApp);
				const firstRes = await testApp.withSignIn(
					{ body: user },
					{
						fn: testApp.addCartItem,
						args: {
							body: {
								productSkuId: productsSkusIds[0].id,
								quantity: 2,
							},
						},
					},
				);
				expect(firstRes.statusCode).toBe(201);

				const cookie = firstRes.cookies.find(
					(c) => c.name === testApp.app.config.application.sessionCookieName,
				);
				expect(cookie).toBeDefined();

				const secondRes = await testApp.addCartItem({
					body: {
						productSkuId: productsSkusIds[0].id,
						quantity: 3,
					},
					cookies: { [cookie!.name]: cookie!.value },
				});

				expect(secondRes.statusCode).toBe(201);

				const cartItem = await testApp.app.kysely
					.selectFrom("cartItem")
					.selectAll()
					.innerJoin("cart", "cart.id", "cartItem.cartId")
					.innerJoin("users", "users.id", "cart.userId")
					.where("users.email", "=", user.email.toLowerCase())
					.where("productSkuId", "=", productsSkusIds[0].id)
					.executeTakeFirst();

				expect(cartItem).toBeDefined();
				expect(cartItem?.quantity).toBe(3);
			});
		});

		it("Should return 400 status code when data is invalid", async () => {
			await withTestApp(async (testApp) => {
				const productsSkusIds = await setup(testApp);
				const testCases = [
					{},
					{
						name: "productSkuIs is string",
						productSkuId: "invalid id",
						quantity: 1,
					},
					{
						name: "quantity is string",
						productSkuId: productsSkusIds[0].id,
						quantity: "string",
					},
					{
						name: "quantity is 0",
						productSkuId: productsSkusIds[0].id,
						quantity: 0,
					},
					{
						name: "Negative quantity",
						quantity: -1,
						productSkuId: productsSkusIds[0].id,
					},
					{
						name: `quantity greater than ${CartItemMaxQuantityPerProduct}`,
						quantity: CartItemMaxQuantityPerProduct + 1,
						productSkuId: productsSkusIds[0].id,
					},
					{
						name: "missing quantity",
						productSkuId: productsSkusIds[0].id,
					},
					{
						name: "missing productSkuId",
						quantity: 5,
					},
				];

				const responses = await testApp.withSignIn(
					{
						body: user,
					},
					testCases.map((body) => ({
						fn: testApp.addCartItem,
						args: {
							body,
						},
					})),
				);

				for (const res of responses as unknown as LightMyRequestResponse[]) {
					expect(res.statusCode).toBe(400);
				}
			});
		});

		it("Should return 400 when cart item limit is reached", async () => {
			await withTestApp(async (testApp) => {
				const productsSkusIds = await setup(testApp);
				const responses = await testApp.withSignIn(
					{ body: user },
					productsSkusIds.slice(0, MaxCartItemCount).map((p) => ({
						fn: testApp.addCartItem,
						args: {
							body: {
								productSkuId: p.id,
								quantity: 5,
							},
						},
					})),
				);

				for (const res of responses as unknown as LightMyRequestResponse[])
					expect(res.statusCode).toBe(201);

				const cookie = (
					responses as unknown as LightMyRequestResponse[]
				)[0].cookies.find(
					(c) => c.name === testApp.app.config.application.sessionCookieName,
				);
				expect(cookie).toBeDefined();

				const lastRes = await testApp.addCartItem({
					body: {
						productSkuId: productsSkusIds.at(MaxCartItemCount)!.id,
						quantity: 3,
					},
					cookies: { [cookie!.name]: cookie!.value },
				});

				expect(lastRes.statusCode).toBe(400);
			});
		});

		it("Should return 401 status code when user is not authorized", async () => {
			await withTestApp(async (testApp) => {
				const addCartItemRes = await testApp.addCartItem();

				expect(addCartItemRes.statusCode).toBe(401);
			});
		});

		it("Should return 404 status code when product sku is not found", async () => {
			await withTestApp(async (testApp) => {
				const productsSkusIds = await setup(testApp);
				const addCartItemRes = await testApp.withSignIn(
					{ body: user },
					{
						fn: testApp.addCartItem,
						args: {
							body: {
								productSkuId: Math.max(...productsSkusIds.map((p) => p.id)) + 1,
								quantity: 5,
							},
						},
					},
				);
				expect(addCartItemRes.statusCode).toBe(404);
			});
		});

		it("Should be rate limited", async () => {
			await withTestApp(async (testApp) => {
				const productsSkusIds = await setup(testApp);
				const responses = await testApp.withSignIn(
					{
						body: user,
					},
					Array.from({
						length: testApp.app.config.rateLimit.addCartItemLimit!,
					}).map(() => ({
						fn: testApp.addCartItem,
						args: {
							body: {
								productSkuId: productsSkusIds[0].id,
								quantity: 5,
							},
						},
					})),
				);

				for (const res of responses as unknown as LightMyRequestResponse[])
					expect(res.statusCode).toBe(201);

				const addCartItemLastRes = await testApp.withSignIn(
					{
						body: {
							email: faker.internet.email(),
							password: faker.internet.password({
								length: SignUpPasswordMinLength,
							}),
						},
					},
					{
						fn: testApp.addCartItem,
						args: {
							body: {
								productSkuId: productsSkusIds[0].id,
								quantity: 5,
							},
						},
					},
				);

				expect(addCartItemLastRes.statusCode).toBe(429);
			});
		});
	});
});
