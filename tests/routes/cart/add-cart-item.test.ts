import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { MaxCartItemCount } from "../../../src/const/const.js";
import {
	CartItemMaxQuantityPerProduct,
	SignUpPasswordMinLength,
} from "../../../src/const/zod.js";
import type { ProductSku } from "../../../src/types/db/product.js";
import { buildTestApp } from "../../testApp.js";

describe("Cart", () => {
	let testApp: Awaited<ReturnType<typeof buildTestApp>>;
	let productsSkuSIds: Pick<ProductSku, "id">[] = [];
	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({ length: SignUpPasswordMinLength }),
	};

	beforeEach(async () => {
		testApp = await buildTestApp();

		const productsSkus = await testApp.app.kysely
			.selectFrom("productSku")
			.select(["id"])
			.execute();

		productsSkuSIds = productsSkus;
	});

	afterEach(async () => {
		await testApp.close();
	});

	describe("Add Cart Item", () => {
		it("Should return 201 status code when request is successful", async () => {
			const addCartItemRes = await testApp.withSignIn(
				{ body: user },
				{
					fn: testApp.addCartItem,
					args: {
						body: {
							productSkuId: productsSkuSIds[0].id,
							quantity: 5,
						},
					},
				},
			);
			expect(addCartItemRes.statusCode).toBe(201);
		});

		it("Should save into database when request is successful", async () => {
			const addCartItemRes = await testApp.withSignIn(
				{ body: user },
				{
					fn: testApp.addCartItem,
					args: {
						body: {
							productSkuId: productsSkuSIds[0].id,
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
				.where("productSkuId", "=", productsSkuSIds[0].id)
				.executeTakeFirst();

			expect(cartItem).toBeDefined();
			expect(cartItem?.quantity).toBe(5);
		});

		it("Should update quantity when adding the same productSku again", async () => {
			const firstRes = await testApp.withSignIn(
				{ body: user },
				{
					fn: testApp.addCartItem,
					args: {
						body: {
							productSkuId: productsSkuSIds[0].id,
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
					productSkuId: productsSkuSIds[0].id,
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
				.where("productSkuId", "=", productsSkuSIds[0].id)
				.executeTakeFirst();

			expect(cartItem).toBeDefined();
			expect(cartItem?.quantity).toBe(3);
		});

		it("Should return 400 status code when data is invalid", async () => {
			const testCases = [
				{},
				{
					name: "productSkuIs is string",
					productSkuId: "invalid id",
					quantity: 1,
				},
				{
					name: "quantity is string",
					productSkuId: productsSkuSIds[0].id,
					quantity: "string",
				},
				{
					name: "quantity is 0",
					productSkuId: productsSkuSIds[0].id,
					quantity: 0,
				},
				{
					name: "Negative quantity",
					quantity: -1,
					productSkuId: productsSkuSIds[0].id,
				},
				{
					name: `quantity greater than ${CartItemMaxQuantityPerProduct}`,
					quantity: CartItemMaxQuantityPerProduct + 1,
					productSkuId: productsSkuSIds[0].id,
				},
				{
					name: "missing quantity",
					productSkuId: productsSkuSIds[0].id,
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

		it("Should return 400 when cart item limit is reached", async () => {
			const responses = await testApp.withSignIn(
				{ body: user },
				productsSkuSIds.slice(0, MaxCartItemCount).map((p) => ({
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
					productSkuId: productsSkuSIds.at(MaxCartItemCount)!.id,
					quantity: 3,
				},
				cookies: { [cookie!.name]: cookie!.value },
			});

			expect(lastRes.statusCode).toBe(400);
		});

		it("Should return 401 status code when user is not authorized", async () => {
			const addCartItemRes = await testApp.addCartItem();

			expect(addCartItemRes.statusCode).toBe(401);
		});

		it("Should return 404 status code when product sku is not found", async () => {
			const addCartItemRes = await testApp.withSignIn(
				{ body: user },
				{
					fn: testApp.addCartItem,
					args: {
						body: {
							productSkuId: Math.max(...productsSkuSIds.map((p) => p.id)) + 1,
							quantity: 5,
						},
					},
				},
			);
			expect(addCartItemRes.statusCode).toBe(404);
		});

		it("Should be rate limited", async () => {
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
							productSkuId: productsSkuSIds[0].id,
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
							productSkuId: productsSkuSIds[0].id,
							quantity: 5,
						},
					},
				},
			);

			expect(addCartItemLastRes.statusCode).toBe(429);
		});
	});
});
