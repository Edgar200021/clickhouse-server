import { faker } from "@faker-js/faker";
import type { LightMyRequestResponse } from "fastify";
import { describe, expect, it } from "vitest";
import { SignUpPasswordMinLength } from "../../../src/const/zod.js";
import type { CartItem } from "../../../src/types/db/cart.js";
import { type TestApp, withTestApp } from "../../testApp.js";

describe("Cart", () => {
	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({ length: SignUpPasswordMinLength }),
	};

	async function setup(testApp: TestApp) {
		const productSku = await testApp.app.kysely
			.selectFrom("productSku")
			.select(["id"])
			.executeTakeFirstOrThrow();

		const res = await testApp.withSignIn(
			{ body: user },
			{
				fn: testApp.addCartItem,
				args: {
					body: {
						productSkuId: productSku.id,
						quantity: 5,
					},
				},
			},
		);

		const cartItem = await testApp.app.kysely
			.selectFrom("cartItem")
			.select("cartItem.id")
			.innerJoin("cart", "cart.id", "cartItem.cartId")
			.innerJoin("users", "users.id", "cart.userId")
			.where("users.email", "=", user.email.toLowerCase())
			.where("productSkuId", "=", productSku.id)
			.executeTakeFirstOrThrow();

		return {
			cartItem,
			cookies: res.cookies.reduce((acc: Record<string, string>, val) => {
				acc[val.name] = val.value;
				return acc;
			}, {}),
		};
	}

	describe("Delete Cart Item", () => {
		it("Should return 200 status code when request is successful", async () => {
			await withTestApp(async (testApp) => {
				const data = await setup(testApp);
				const deleteCartItemRes = await testApp.deleteCartItem(
					{
						cookies: data?.cookies,
					},
					data?.cartItem.id,
				);
				expect(deleteCartItemRes.statusCode).toBe(200);
			});
		});

		it("Should be deleted from database when request is successful", async () => {
			await withTestApp(async (testApp) => {
				const data = await setup(testApp);
				const deleteCartItemRes = await testApp.deleteCartItem(
					{
						cookies: data?.cookies,
					},
					data?.cartItem.id,
				);
				expect(deleteCartItemRes.statusCode).toBe(200);

				const cartItem = await testApp.app.kysely
					.selectFrom("cartItem")
					.select("id")
					.where("id", "=", data!.cartItem.id)
					.executeTakeFirst();

				expect(cartItem).toBeUndefined();
			});
		});

		it("Should return 400 status code when data is invalid", async () => {
			await withTestApp(async (testApp) => {
				const data = await setup(testApp);
				const testCases = [
					{
						name: "cartItemId is string",
						cartItemId: "invalid",
					},
					{
						name: "cartItemId is zero",
						cartItemId: 0,
					},
					{
						name: "cartItemId is negative",
						cartItemId: -1,
					},
				];

				const responses = await Promise.all(
					testCases.map(
						async (t) =>
							await testApp.deleteCartItem(
								{
									cookies: data?.cookies,
								},
								t.cartItemId as unknown as CartItem["id"],
							),
					),
				);

				for (const res of responses as unknown as LightMyRequestResponse[]) {
					expect(res.statusCode).toBe(400);
				}
			});
		});

		it("Should return 401 status code when user is not authorized", async () => {
			await withTestApp(async (testApp) => {
				const data = await setup(testApp);
				const deleteCartItemRes = await testApp.deleteCartItem(
					{},
					data?.cartItem.id,
				);

				expect(deleteCartItemRes.statusCode).toBe(401);
			});
		});

		it("Should return 404 status code when cart item is not found", async () => {
			await withTestApp(async (testApp) => {
				const data = await setup(testApp);
				const deleteCartItemRes = await testApp.deleteCartItem(
					{
						cookies: data?.cookies,
					},
					data!.cartItem.id + 1,
				);
				expect(deleteCartItemRes.statusCode).toBe(404);
			});
		});

		it("Should be rate limited", async () => {
			await withTestApp(async (testApp) => {
				const data = await setup(testApp);
				const responses = await Promise.all(
					Array.from({
						length: testApp.app.config.rateLimit.deleteCartItemLimit!,
					}).map(
						async () =>
							await testApp.deleteCartItem(
								{
									cookies: data?.cookies,
								},
								data?.cartItem.id,
							),
					),
				);
				for (const res of responses as unknown as LightMyRequestResponse[])
					expect(res.statusCode).toBeOneOf([200, 404]);

				const deleteCartItemLastRes = await testApp.deleteCartItem(
					{
						cookies: data?.cookies,
					},
					data?.cartItem.id,
				);
				expect(deleteCartItemLastRes.statusCode).toBe(429);
			});
		});
	});
});
