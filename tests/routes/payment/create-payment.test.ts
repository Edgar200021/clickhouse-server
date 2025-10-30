import {faker} from "@faker-js/faker";
import {sql} from "kysely";
import {describe, expect, it} from "vitest";
import {
	CreateOrderApartmentMaxLength,
	CreateOrderCityMaxLength,
	CreateOrderHomeMaxLength,
	CreateOrderNameMaxLength,
	CreateOrderStreetMaxLength,
	SignUpPasswordMinLength,
} from "../../../src/const/zod.js";
import {Currency, OrderStatus, PaymentStatus,} from "../../../src/types/db/db.js";
import {type TestApp, withTestApp} from "../../testApp.js";

describe("Payment", () => {
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
	) => {
		const productsInStock = productsSkus
			.filter((p) => p.quantity > 0)
			.slice(0, 100);

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
					quantity: Math.floor(p.quantity / 5) || 1,
				})),
			)
			.execute();

		const signInRes = await testApp.signIn({body: user});
		expect(signInRes.statusCode).toBe(200);

		const cookie = signInRes.cookies.find(
			(c) => c.name === testApp.app.config.application.sessionCookieName,
		);
		expect(cookie).toBeDefined();

		const createOrderResponse = await testApp.createOrder({
			body: order,
			cookies: {
				[cookie!.name]: cookie!.value,
			},
		});

		expect(createOrderResponse.statusCode).toBe(201);

		return {
			cookie: cookie!,
			orderNumber: createOrderResponse.json<{
				data: { orderNumber: string };
			}>().data.orderNumber,
		};
	};

	describe("Create order", () => {
		it("Should return 201 status code when request is successful", async () => {
			await withTestApp(async (testApp) => {
				const productsSkus = await setup(testApp);
				const {cookie, orderNumber} = await createOrder(
					testApp,
					productsSkus,
				);

				const createPaymentResponse = await testApp.createPayment({
					body: {orderNumber},
					cookies: {
						[cookie!.name]: cookie!.value,
					},
				});

				expect(createPaymentResponse.statusCode).toBe(201);
			});
		});

		it("Should be saved into database when request is successful", async () => {
			await withTestApp(async (testApp) => {
				const productsSkus = await setup(testApp);
				const {cookie, orderNumber} = await createOrder(
					testApp,
					productsSkus,
				);

				const createPaymentResponse = await testApp.createPayment({
					body: {orderNumber},
					cookies: {
						[cookie!.name]: cookie!.value,
					},
				});

				expect(createPaymentResponse.statusCode).toBe(201);

				const dbPayment = await testApp.app.kysely
					.selectFrom("payment")
					.innerJoin("order", "order.id", "payment.orderId")
					.innerJoin("users", "users.id", "order.userId")
					.select("payment.status")
					.where("order.number", "=", orderNumber)
					.where("users.email", "=", user.email.toLowerCase())
					.executeTakeFirst();

				expect(dbPayment).toBeDefined();
				expect(dbPayment!.status).toEqual(PaymentStatus.Pending);
			});
		});

		it("Should return 400 status code when data is invalid", async () => {
			await withTestApp(async (testApp) => {
				const productsSkus = await setup(testApp);
				const {cookie} = await createOrder(testApp, productsSkus);

				const testCases = [
					{name: "Empty body", body: {}},
					{
						name: "Non uuid",
						body: {
							orderNumber: "Random string",
						},
					},
				];

				const responses = await Promise.all(
					testCases.map((t) =>
						testApp.createPayment({
							body: t.body,
							cookies: {
								[cookie!.name]: cookie!.value,
							},
						}),
					),
				);

				for (const response of responses) expect(response.statusCode).toBe(400);
			});
		});

		it(`Should return 400 status code when order status is not ${OrderStatus.Pending}`, async () => {
			await withTestApp(async (testApp) => {
				const productsSkus = await setup(testApp);
				const {cookie, orderNumber} = await createOrder(
					testApp,
					productsSkus,
				);

				await testApp.app.kysely
					.updateTable("order")
					.set({status: OrderStatus.Paid})
					.where("order.number", "=", orderNumber)
					.executeTakeFirstOrThrow();

				const createPaymentResponse = await testApp.createPayment({
					body: {orderNumber},
					cookies: {
						[cookie!.name]: cookie!.value,
					},
				});

				expect(createPaymentResponse.statusCode).toBe(400);
			});
		});

		it(`Should return 400 status code when payment time is expired`, async () => {
			await withTestApp(async (testApp) => {
				const productsSkus = await setup(testApp);
				const {cookie, orderNumber} = await createOrder(
					testApp,
					productsSkus,
				);

				await testApp.app.kysely
					.updateTable("order")
					.set({
						createdAt: sql<Date>`"order"."created_at" - interval '${sql.raw(
							testApp.app.config.application.orderPaymentTTLMinutes.toString(),
						)} minute'`,
					})
					.where("order.number", "=", orderNumber)
					.executeTakeFirstOrThrow();

				const createPaymentResponse = await testApp.createPayment({
					body: {orderNumber},
					cookies: {
						[cookie!.name]: cookie!.value,
					},
				});

				expect(createPaymentResponse.statusCode).toBe(400);
			});
		});

		it("Should return 401 status code when user is not authorized", async () => {
			await withTestApp(async (testApp) => {
				const createPaymentRes = await testApp.createPayment();

				expect(createPaymentRes.statusCode).toBe(401);
			});
		});

		it("Should be rate limited", async () => {
			await withTestApp(async (testApp) => {
				const productsSkus = await setup(testApp);
				const {cookie, orderNumber} = await createOrder(
					testApp,
					productsSkus,
				);

				for (
					let i = 0;
					i < testApp.app.config.rateLimit.createPaymentLimit!;
					i++
				) {
					const createPaymentResponse = await testApp.createPayment({
						body: {orderNumber},
						cookies: {
							[cookie!.name]: cookie!.value,
						},
					});

					expect(createPaymentResponse.statusCode).toBe(201);
				}

				const createPaymentLastRes = await testApp.createPayment({
					body: {orderNumber},
					cookies: {
						[cookie!.name]: cookie!.value,
					},
				});

				expect(createPaymentLastRes.statusCode).toBe(429);
			});
		});
	});
});