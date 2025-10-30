import {faker} from "@faker-js/faker";
import {describe, expect, it} from "vitest";
import {
	CreateOrderApartmentMaxLength,
	CreateOrderCityMaxLength,
	CreateOrderHomeMaxLength,
	CreateOrderNameMaxLength,
	CreateOrderStreetMaxLength,
	SignUpPasswordMinLength,
} from "../../../src/const/zod.js";
import {Currency, OrderStatus} from "../../../src/types/db/db.js";
import {omit, type TestApp, withTestApp} from "../../testApp.js";

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

	const insertValidProductsIntoCart = async (
		testApp: TestApp,
		productsSkus: Awaited<ReturnType<typeof setup>>,
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
					quantity: Math.floor(p.quantity / 5) || 1,
				})),
			)
			.execute();
	};

	describe("Create order", () => {
		it("Should return 201 status code when request is successful", async () => {
			await withTestApp(async (testApp) => {
				const productsSkus = await setup(testApp);
				await insertValidProductsIntoCart(testApp, productsSkus);

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
			});
		});

		it("Should be saved into database when request is successful", async () => {
			await withTestApp(async (testApp) => {
				const productsSkus = await setup(testApp);
				await insertValidProductsIntoCart(testApp, productsSkus);

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
				const {
					data: {orderNumber},
				} = createOrderResponse.json<{
					status: "success";
					data: { orderNumber: string };
				}>();

				const dbOrder = await testApp.app.kysely
					.selectFrom("order")
					.innerJoin("users", "users.id", "order.userId")
					.select("status")
					.where("order.number", "=", orderNumber)
					.where("users.email", "=", user.email.toLowerCase())
					.executeTakeFirst();

				expect(dbOrder).toBeDefined();
				expect(dbOrder!.status).toEqual(OrderStatus.Pending);
			});
		});

		it("Should return 400 status code when data is invalid", async () => {
			await withTestApp(async (testApp) => {
				const productsSkus = await setup(testApp);
				await insertValidProductsIntoCart(testApp, productsSkus);

				const testCases = [
					{name: "Empty body", body: {}},
					{
						name: "Missing currency",
						body: omit(order, "currency"),
					},
					{
						name: "Invalid currency",
						body: {...order, currency: "invalid currency"},
					},
					{
						name: "Missing phone number",
						body: omit(order, "phoneNumber"),
					},
					{
						name: "invalid phone number",
						body: {...order, phoneNumber: "12321321312312"},
					},
					{
						name: "Missing email",
						body: omit(order, "email"),
					},
					{
						name: "Invalid email",
						body: {...order, email: "invalid email"},
					},
					{
						name: "Missing name",
						body: omit(order, "name"),
					},
					{
						name: `Name length more than ${CreateOrderNameMaxLength}`,
						body: {
							...order,
							name: faker.string.alpha(CreateOrderNameMaxLength + 1),
						},
					},
					{
						name: "Missing billing address",
						body: omit(order, "billingAddress"),
					},
					{
						name: "Missing city in billing address",
						body: {
							...order,
							billingAddress: omit(order.billingAddress, "city"),
						},
					},
					{
						name: `Billing city length more than ${CreateOrderCityMaxLength}`,
						body: {
							...order,
							billingAddress: {
								...order.billingAddress,
								city: faker.string.alpha(CreateOrderCityMaxLength + 1),
							},
						},
					},
					{
						name: "Missing street in billing address",
						body: {
							...order,
							billingAddress: omit(order.billingAddress, "street"),
						},
					},
					{
						name: `Billing street length more than ${CreateOrderStreetMaxLength}`,
						body: {
							...order,
							billingAddress: {
								...order.billingAddress,
								street: faker.string.alpha(CreateOrderStreetMaxLength + 1),
							},
						},
					},
					{
						name: "Missing home in billing address",
						body: {
							...order,
							billingAddress: omit(order.billingAddress, "home"),
						},
					},
					{
						name: `Billing home length more than ${CreateOrderHomeMaxLength}`,
						body: {
							...order,
							billingAddress: {
								...order.billingAddress,
								home: faker.string.alpha(CreateOrderHomeMaxLength + 1),
							},
						},
					},
					{
						name: "Missing apartment in billing address",
						body: {
							...order,
							billingAddress: omit(order.billingAddress, "apartment"),
						},
					},
					{
						name: `Billing apartment length more than ${CreateOrderApartmentMaxLength}`,
						body: {
							...order,
							billingAddress: {
								...order.billingAddress,
								apartment: faker.string.alpha(
									CreateOrderApartmentMaxLength + 1,
								),
							},
						},
					},
					{
						name: "Missing delivery address",
						body: omit(order, "deliveryAddress"),
					},
					{
						name: "Missing city in delivery address",
						body: {
							...order,
							deliveryAddress: omit(order.deliveryAddress, "city"),
						},
					},
					{
						name: `Delivery city length more than ${CreateOrderCityMaxLength}`,
						body: {
							...order,
							deliveryAddress: {
								...order.deliveryAddress,
								city: faker.string.alpha(CreateOrderCityMaxLength + 1),
							},
						},
					},
					{
						name: "Missing street in delivery address",
						body: {
							...order,
							deliveryAddress: omit(order.deliveryAddress, "street"),
						},
					},
					{
						name: `Delivery street length more than ${CreateOrderStreetMaxLength}`,
						body: {
							...order,
							deliveryAddress: {
								...order.deliveryAddress,
								street: faker.string.alpha(CreateOrderStreetMaxLength + 1),
							},
						},
					},
					{
						name: "Missing home in delivery address",
						body: {
							...order,
							deliveryAddress: omit(order.deliveryAddress, "home"),
						},
					},
					{
						name: `Delivery home length more than ${CreateOrderHomeMaxLength}`,
						body: {
							...order,
							deliveryAddress: {
								...order.deliveryAddress,
								home: faker.string.alpha(CreateOrderHomeMaxLength + 1),
							},
						},
					},
					{
						name: "Missing apartment in delivery address",
						body: {
							...order,
							deliveryAddress: omit(order.deliveryAddress, "apartment"),
						},
					},
					{
						name: `Delivery apartment length more than ${CreateOrderApartmentMaxLength}`,
						body: {
							...order,
							deliveryAddress: {
								...order.deliveryAddress,
								apartment: faker.string.alpha(
									CreateOrderApartmentMaxLength + 1,
								),
							},
						},
					},
				];

				const signInRes = await testApp.signIn({body: user});
				expect(signInRes.statusCode).toBe(200);

				const cookie = signInRes.cookies.find(
					(c) => c.name === testApp.app.config.application.sessionCookieName,
				);
				expect(cookie).toBeDefined();

				const responses = await Promise.all(
					testCases.map((t) =>
						testApp.createOrder({
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

		it("Should return 400 status code when user has too many pending orders", async () => {
			await withTestApp(async (testApp) => {
				const productsSkus = await setup(testApp);
				await insertValidProductsIntoCart(testApp, productsSkus);

				const signInRes = await testApp.signIn({body: user});
				expect(signInRes.statusCode).toBe(200);

				const cookie = signInRes.cookies.find(
					(c) => c.name === testApp.app.config.application.sessionCookieName,
				);
				expect(cookie).toBeDefined();

				const responses = await Promise.all(
					Array.from({
						length: testApp.app.config.application.maxPendingOrdersPerUser,
					}).map(() =>
						testApp.createOrder({
							body: order,
							cookies: {
								[cookie!.name]: cookie!.value,
							},
						}),
					),
				);

				for (const response of responses) expect(response.statusCode).toBe(201);

				const createOrderLastRes = await testApp.createOrder({
					body: order,
					cookies: {[cookie!.name]: cookie!.value},
				});

				expect(createOrderLastRes.statusCode).toBe(400);
			});
		});

		it("Should return 400 status code when cart is empty", async () => {
			await withTestApp(async (testApp) => {
				const verifyRes = await testApp.createAndVerify({body: user});
				expect(verifyRes.statusCode).toBe(200);

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

				expect(createOrderResponse.statusCode).toBe(400);
			});
		});

		it("Should return 401 status code when user is not authorized", async () => {
			await withTestApp(async (testApp) => {
				const createOrderRes = await testApp.createOrder();

				expect(createOrderRes.statusCode).toBe(401);
			});
		});

		it("Should be rate limited", async () => {
			await withTestApp(async (testApp) => {
				const verifyRes = await testApp.createAndVerify({body: user});
				expect(verifyRes.statusCode).toBe(200);

				const signInRes = await testApp.signIn({body: user});
				expect(signInRes.statusCode).toBe(200);

				const cookie = signInRes.cookies.find(
					(c) => c.name === testApp.app.config.application.sessionCookieName,
				);
				expect(cookie).toBeDefined();

				for (
					let i = 0;
					i < testApp.app.config.rateLimit.createOrderLimit!;
					i++
				) {
					const createOrderResponse = await testApp.createOrder({
						cookies: {
							[cookie!.name]: cookie!.value,
						},
					});

					expect(createOrderResponse.statusCode).toBe(400);
				}

				const createOrderLastRes = await testApp.createOrder({
					cookies: {
						[cookie!.name]: cookie!.value,
					},
				});

				expect(createOrderLastRes.statusCode).toBe(429);
			});
		});
	});
});