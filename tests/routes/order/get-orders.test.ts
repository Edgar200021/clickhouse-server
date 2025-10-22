import { faker } from "@faker-js/faker";
import type { LightMyRequestResponse } from "fastify";
import { describe, expect, it } from "vitest";
import {
	CreateOrderApartmentMaxLength,
	CreateOrderCityMaxLength,
	CreateOrderHomeMaxLength,
	CreateOrderNameMaxLength,
	CreateOrderStreetMaxLength,
	GetOrdersMaxLimit,
	SignUpPasswordMinLength,
} from "../../../src/const/zod.js";
import { Currency } from "../../../src/types/db/db.js";
import { type TestApp, withTestApp } from "../../testApp.js";

describe("Order", () => {
	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({ length: SignUpPasswordMinLength }),
	};

	const order = {
		currency: Currency.Rub,
		phoneNumber: faker.phone.number({ style: "international" }),
		email: user.email,
		name: faker.string.sample({ min: 5, max: CreateOrderNameMaxLength }),
		billingAddress: {
			city: faker.string.sample({ min: 5, max: CreateOrderCityMaxLength }),
			street: faker.string.sample({ min: 5, max: CreateOrderStreetMaxLength }),
			home: faker.string.sample({ min: 5, max: CreateOrderHomeMaxLength }),
			apartment: faker.string.sample({
				min: 5,
				max: CreateOrderApartmentMaxLength,
			}),
		},
		deliveryAddress: {
			city: faker.string.sample({ min: 5, max: CreateOrderCityMaxLength }),
			street: faker.string.sample({ min: 5, max: CreateOrderStreetMaxLength }),
			home: faker.string.sample({ min: 5, max: CreateOrderHomeMaxLength }),
			apartment: faker.string.sample({
				min: 5,
				max: CreateOrderApartmentMaxLength,
			}),
		},
	};

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

		await testApp.createAndVerify({ body: user });

		return productsSkus;
	};

	const createOrders = async (
		testApp: TestApp,
		productsSkus: Awaited<ReturnType<typeof setup>>,
		cookie: LightMyRequestResponse["cookies"][1],
	) => {
		const productsInStock = productsSkus.filter((p) => p.quantity > 0);
		const { id } = await testApp.app.kysely
			.selectFrom("cart")
			.select("cart.id")
			.innerJoin("users", "users.id", "cart.userId")
			.where("users.email", "=", user.email.toLowerCase())
			.executeTakeFirstOrThrow();

		await testApp.app.kysely
			.insertInto("cartItem")
			.values(
				productsInStock.map((p) => ({
					cartId: id,
					productSkuId: p.id,
					quantity: p.quantity / 5 > 0 ? Math.floor(p.quantity / 5) : 1,
				})),
			)
			.execute();

		const responses = await Promise.all(
			Array.from({ length: 3 }).map(() =>
				testApp.createOrder({
					body: order,
					cookies: {
						[cookie!.name]: cookie!.value,
					},
				}),
			),
		);

		for (const res of responses) expect(res.statusCode).toBe(201);
	};

	describe("Get orders", () => {
		it("Should return 200 status code when request is successfull", async () => {
			await withTestApp(async (testApp) => {
				const productsSkus = await setup(testApp);

				const signInRes = await testApp.signIn({ body: user });
				expect(signInRes.statusCode).toBe(200);

				const cookie = signInRes.cookies.find(
					(c) => c.name === testApp.app.config.application.sessionCookieName,
				);
				expect(cookie).toBeDefined();

				await createOrders(testApp, productsSkus, cookie!);

				const getOrdersResponse = await testApp.getOrders({
					cookies: {
						[cookie!.name]: cookie!.value,
					},
				});

				expect(getOrdersResponse.statusCode).toBe(200);
			});
		});

		it("Should return 400 status code when filters are invalid", async () => {
			await withTestApp(async (testApp) => {
				const productsSkus = await setup(testApp);

				const signInRes = await testApp.signIn({ body: user });
				expect(signInRes.statusCode).toBe(200);

				const cookie = signInRes.cookies.find(
					(c) => c.name === testApp.app.config.application.sessionCookieName,
				);
				expect(cookie).toBeDefined();

				await createOrders(testApp, productsSkus, cookie!);

				const testCases = [
					{
						name: "Invalid status",
						query: {
							status: "invalid",
						},
					},
					{
						name: "Negative limit",
						query: {
							limit: -5,
						},
					},
					{
						name: "Zero limit",
						query: {
							limit: 0,
						},
					},
					{
						name: `Limit is greater than ${GetOrdersMaxLimit}`,
						query: {
							limit: GetOrdersMaxLimit + 1,
						},
					},
					{
						name: "Negative page",
						query: {
							page: -5,
						},
					},
					{
						name: "Zero page",
						query: {
							page: 0,
						},
					},
				];

				const responses = await Promise.all(
					testCases.map((t) =>
						testApp.getOrders({
							query: t.query as unknown as Record<string, string>,
							cookies: {
								[cookie!.name]: cookie!.value,
							},
						}),
					),
				);

				for (const response of responses) expect(response.statusCode).toBe(400);
			});
		});

		it("Should return 401 status code when user is not authorized", async () => {
			await withTestApp(async (testApp) => {
				const getOrdersRes = await testApp.getOrders({});

				expect(getOrdersRes.statusCode).toBe(401);
			});
		});

		it("Should be rate limited", async () => {
			await withTestApp(async (testApp) => {
				await setup(testApp);

				const signInRes = await testApp.signIn({ body: user });
				expect(signInRes.statusCode).toBe(200);

				const cookie = signInRes.cookies.find(
					(c) => c.name === testApp.app.config.application.sessionCookieName,
				);
				expect(cookie).toBeDefined();

				for (let i = 0; i < testApp.app.config.rateLimit.getOrdersLimit!; i++) {
					const getOrdersResponse = await testApp.getOrders({
						cookies: {
							[cookie!.name]: cookie!.value,
						},
					});

					expect(getOrdersResponse.statusCode).toBe(200);
				}

				const getOrdersLastRes = await testApp.getOrders({
					cookies: {
						[cookie!.name]: cookie!.value,
					},
				});

				expect(getOrdersLastRes.statusCode).toBe(429);
			});
		});
	});
});
