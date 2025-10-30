import {randomUUID} from "node:crypto";
import {faker} from "@faker-js/faker";
import type {LightMyRequestResponse} from "fastify";
import {describe, expect, it} from "vitest";
import {
	CreateOrderApartmentMaxLength,
	CreateOrderCityMaxLength,
	CreateOrderHomeMaxLength,
	CreateOrderNameMaxLength,
	CreateOrderStreetMaxLength,
	SignUpPasswordMinLength,
} from "../../../src/const/zod.js";
import {Currency} from "../../../src/types/db/db.js";
import type {Order} from "../../../src/types/db/order.js";
import {type TestApp, withTestApp} from "../../testApp.js";

describe("Order", () => {
	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({length: SignUpPasswordMinLength}),
	};

	const order = {
		currency: Currency.Rub,
		phoneNumber: faker.phone.number({style: "international"}),
		email: user.email,
		name: faker.string.sample({min: 5, max: CreateOrderNameMaxLength}),
		billingAddress: {
			city: faker.string.sample({min: 5, max: CreateOrderCityMaxLength}),
			street: faker.string.sample({min: 5, max: CreateOrderStreetMaxLength}),
			home: faker.string.sample({min: 5, max: CreateOrderHomeMaxLength}),
			apartment: faker.string.sample({
				min: 5,
				max: CreateOrderApartmentMaxLength,
			}),
		},
		deliveryAddress: {
			city: faker.string.sample({min: 5, max: CreateOrderCityMaxLength}),
			street: faker.string.sample({min: 5, max: CreateOrderStreetMaxLength}),
			home: faker.string.sample({min: 5, max: CreateOrderHomeMaxLength}),
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

		await testApp.createAndVerify({body: user});

		return productsSkus;
	};

	const createOrder = async (
		testApp: TestApp,
		productsSkus: Awaited<ReturnType<typeof setup>>,
		cookie: LightMyRequestResponse["cookies"][1],
	) => {
		const productsInStock = productsSkus.filter((p) => p.quantity > 0);
		const {id} = await testApp.app.kysely
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
					quantity: p.quantity - 1,
				})),
			)
			.execute();

		const createOrderResponse = await testApp.createOrder({
			body: order,
			cookies: {
				[cookie!.name]: cookie!.value,
			},
		});

		expect(createOrderResponse.statusCode).toBe(201);

		return createOrderResponse.json<{ data: { orderNumber: string } }>().data
			.orderNumber;
	};

	describe("Get order", () => {
		it("Should return 200 status code when request is successful", async () => {
			await withTestApp(async (testApp) => {
				const productsSkus = await setup(testApp);

				const signInRes = await testApp.signIn({body: user});
				expect(signInRes.statusCode).toBe(200);

				const cookie = signInRes.cookies.find(
					(c) => c.name === testApp.app.config.application.sessionCookieName,
				);
				expect(cookie).toBeDefined();

				const orderNumber = await createOrder(testApp, productsSkus, cookie!);

				const getOrderResponse = await testApp.getOrder(
					{
						cookies: {
							[cookie!.name]: cookie!.value,
						},
					},
					orderNumber,
				);

				expect(getOrderResponse.statusCode).toBe(200);
			});
		});

		it("Should return 400 status code when data is invalid", async () => {
			await withTestApp(async (testApp) => {
				const productsSkus = await setup(testApp);

				const signInRes = await testApp.signIn({body: user});
				expect(signInRes.statusCode).toBe(200);

				const cookie = signInRes.cookies.find(
					(c) => c.name === testApp.app.config.application.sessionCookieName,
				);
				expect(cookie).toBeDefined();

				await createOrder(testApp, productsSkus, cookie!);

				const testCases = [
					{name: "Not uuid", id: "string"},
					{name: "Number", id: 4},
				];

				const responses = await Promise.all(
					testCases.map((t) =>
						testApp.getOrder(
							{
								cookies: {
									[cookie!.name]: cookie!.value,
								},
							},
							t.id as Order["number"],
						),
					),
				);

				for (const response of responses) expect(response.statusCode).toBe(400);
			});
		});

		it("Should return 401 status code when user is not authorized", async () => {
			await withTestApp(async (testApp) => {
				const getOrderRes = await testApp.getOrder({}, randomUUID().toString());

				expect(getOrderRes.statusCode).toBe(401);
			});
		});

		it("Should return 404 status code when order doesn't exist", async () => {
			await withTestApp(async (testApp) => {
				await setup(testApp);

				const signInRes = await testApp.signIn({body: user});
				expect(signInRes.statusCode).toBe(200);

				const cookie = signInRes.cookies.find(
					(c) => c.name === testApp.app.config.application.sessionCookieName,
				);
				expect(cookie).toBeDefined();

				const getOrderResponse = await testApp.getOrder(
					{
						body: order,
						cookies: {
							[cookie!.name]: cookie!.value,
						},
					},
					randomUUID().toString(),
				);

				expect(getOrderResponse.statusCode).toBe(404);
			});
		});

		it("Should be rate limited", async () => {
			await withTestApp(async (testApp) => {
				await setup(testApp);

				const signInRes = await testApp.signIn({body: user});
				expect(signInRes.statusCode).toBe(200);

				const cookie = signInRes.cookies.find(
					(c) => c.name === testApp.app.config.application.sessionCookieName,
				);
				expect(cookie).toBeDefined();

				for (let i = 0; i < testApp.app.config.rateLimit.getOrderLimit!; i++) {
					const getOrderResponse = await testApp.getOrder(
						{
							cookies: {
								[cookie!.name]: cookie!.value,
							},
						},
						"invalid id",
					);

					expect(getOrderResponse.statusCode).toBe(400);
				}

				const getOrderLastRes = await testApp.getOrder({
					cookies: {
						[cookie!.name]: cookie!.value,
					},
				});

				expect(getOrderLastRes.statusCode).toBe(429);
			});
		});
	});
});