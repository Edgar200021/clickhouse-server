import { faker } from "@faker-js/faker";
import type { LightMyRequestResponse } from "fastify";
import { describe, expect, it } from "vitest";
import { SignUpPasswordMinLength } from "../../../src/const/zod.js";
import type { CartItem } from "../../../src/types/db/cart.js";
import { buildTestApp } from "../../testApp.js";

describe("Cart", () => {
	let testApp: Awaited<ReturnType<typeof buildTestApp>>;
	let data: {
		cartItem: Pick<CartItem, "id">;
		cookies: Record<string, string>;
	} | null = null;

	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({ length: SignUpPasswordMinLength }),
	};

	beforeEach(async () => {
		testApp = await buildTestApp();

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

		data = {
			cartItem,
			cookies: res.cookies.reduce((acc: Record<string, string>, val) => {
				acc[val.name] = val.value;
				return acc;
			}, {}),
		};
	});

	afterEach(async () => {
		await testApp.close();
	});

	describe("Delete Cart Item", () => {
		it("Should return 200 status code when request is successful", async () => {
			const deleteCartItemRes = await testApp.deleteCartItem(
				{
					cookies: data?.cookies,
				},
				data?.cartItem.id,
			);
			expect(deleteCartItemRes.statusCode).toBe(200);
		});

		it("Should be deleted from database when request is successful", async () => {
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

		it("Should return 400 status code when data is invalid", async () => {
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

		it("Should return 401 status code when user is not authorized", async () => {
			const deleteCartItemRes = await testApp.deleteCartItem(
				{},
				data?.cartItem.id,
			);

			expect(deleteCartItemRes.statusCode).toBe(401);
		});

		it("Should return 404 status code when cart item is not found", async () => {
			const deleteCartItemRes = await testApp.deleteCartItem(
				{
					cookies: data?.cookies,
				},
				data!.cartItem.id + 1,
			);
			expect(deleteCartItemRes.statusCode).toBe(404);
		});

		it("Should be rate limited", async () => {
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
