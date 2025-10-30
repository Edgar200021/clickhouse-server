import { faker } from "@faker-js/faker";
import { constructNow, isAfter, isBefore, isWithinInterval } from "date-fns";
import type { LightMyRequestResponse } from "fastify";
import { describe, expect, it } from "vitest";
import { SignUpPasswordMinLength } from "../../../src/const/zod.js";
import { Currency } from "../../../src/types/db/db.js";
import { type TestApp, withTestApp } from "../../testApp.js";

describe("Cart", () => {
	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({ length: SignUpPasswordMinLength }),
	};

	async function setup(testApp: TestApp) {
		const promocodes = await testApp.app.kysely
			.selectFrom("promocode")
			.select(["id", "code", "validFrom", "validTo"])
			.execute();

		const validPromocode = promocodes.find((p) => {
			const now = constructNow(undefined);

			return isWithinInterval(now, { start: p.validFrom, end: p.validTo });
		})!;

		return { promocodes, validPromocode };
	}

	describe("Add Cart Promocode", () => {
		it("Should return 200 status code when request is successful", async () => {
			await withTestApp(async (testApp) => {
				const { validPromocode } = await setup(testApp);
				const addCartPromocodeRes = await testApp.withSignIn(
					{ body: user },
					{
						fn: testApp.addCartPromocode,
						args: {
							body: {
								promocode: validPromocode.code,
							},
						},
					},
				);
				expect(addCartPromocodeRes.statusCode).toBe(200);
			});
		});

		it("Should save into database when request is successful", async () => {
			await withTestApp(async (testApp) => {
				const { validPromocode } = await setup(testApp);
				const addCartPromocodeRes = await testApp.withSignIn(
					{ body: user },
					{
						fn: testApp.addCartPromocode,
						args: {
							body: {
								promocode: validPromocode.code,
							},
						},
					},
				);
				expect(addCartPromocodeRes.statusCode).toBe(200);

				const cartItem = await testApp.app.kysely
					.selectFrom("cart")
					.innerJoin("users", "users.id", "cart.userId")
					.innerJoin("promocode", "promocode.id", "cart.promocodeId")
					.select(["promocode.id as promocodeId"])
					.where("users.email", "=", user.email.toLowerCase())
					.executeTakeFirst();

				expect(cartItem).toBeDefined();
				expect(cartItem!.promocodeId).toEqual(validPromocode.id);
			});
		});

		it("Should return 400 status code when data is invalid", async () => {
			await withTestApp(async (testApp) => {
				const { validPromocode } = await setup(testApp);
				const testCases = [
					{},
					{
						name: "promocode is empty",
						promocode: "",
					},
					{
						name: "promocode is whitespace only",
						promocode: "    ",
					},
				];

				const responses = await testApp.withSignIn(
					{
						body: user,
					},
					testCases.map((body) => ({
						fn: testApp.addCartPromocode,
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

		it("Should return 400 status code when order with provided promocode already exists", async () => {
			await withTestApp(async (testApp) => {
				const { validPromocode } = await setup(testApp);

				const verifyRes = await testApp.createAndVerify({ body: user });
				expect(verifyRes.statusCode).toBe(200);

				const signInRes = await testApp.signIn({ body: user });
				expect(signInRes.statusCode).toBe(200);

				const cookie = signInRes.cookies.find(
					(c) => c.name === testApp.app.config.application.sessionCookieName,
				);
				expect(cookie).toBeDefined();

				const { id } = await testApp.app.kysely
					.selectFrom("users")
					.select("id")
					.where("email", "=", user.email.toLowerCase())
					.executeTakeFirstOrThrow();

				await testApp.app.kysely
					.insertInto("order")
					.values({
						userId: id,
						promocodeId: validPromocode.id,
						currency: Currency.Rub,
						email: user.email,
						name: faker.string.sample(),
						total: 1000,
						phoneNumber: faker.phone.number(),
						billingAddressCity: faker.string.sample(),
						billingAddressStreet: faker.string.sample(),
						billingAddressHome: faker.string.sample(),
						billingAddressApartment: faker.string.sample(),
						deliveryAddressCity: faker.string.sample(),
						deliveryAddressStreet: faker.string.sample(),
						deliveryAddressHome: faker.string.sample(),
						deliveryAddressApartment: faker.string.sample(),
					})
					.execute();

				const addCartPromocodeRes = await testApp.addCartPromocode({
					cookies: { [cookie!.name]: cookie!.value },
					body: {
						promocode: validPromocode.code,
					},
				});

				expect(addCartPromocodeRes.statusCode).toBe(400);
			});
		});

		it("Should return 400 status code when promocode is not valid", async () => {
			await withTestApp(async (testApp) => {
				const { promocodes } = await setup(testApp);
				const testCases = [
					{
						name: "promocode is expired",
						promocode: promocodes.find((p) => {
							const now = constructNow(undefined);

							return isBefore(p.validTo, now);
						})!.code,
					},
					{
						name: "promocode is not active yet",
						promocode: promocodes.find((p) => {
							const now = constructNow(undefined);

							return isAfter(p.validFrom, now);
						})!.code,
					},
				];

				const responses = await testApp.withSignIn(
					{
						body: user,
					},
					testCases.map((body) => ({
						fn: testApp.addCartPromocode,
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

		it("Should return 401 status code when user is not authorized", async () => {
			await withTestApp(async (testApp) => {
				const addCartPromocodeRes = await testApp.addCartPromocode();

				expect(addCartPromocodeRes.statusCode).toBe(401);
			});
		});

		it("Should be rate limited", async () => {
			await withTestApp(async (testApp) => {
				const responses = await testApp.withSignIn(
					{
						body: user,
					},
					Array.from({
						length: testApp.app.config.rateLimit.addCartPromocodeLimit!,
					}).map(() => ({
						fn: testApp.addCartPromocode,
						args: {
							body: {
								promocode: faker.string.uuid(),
							},
						},
					})),
				);

				for (const res of responses as unknown as LightMyRequestResponse[])
					expect(res.statusCode).toBe(404);

				const addCartPromocodeLastRes = await testApp.withSignIn(
					{
						body: {
							email: faker.internet.email(),
							password: faker.internet.password({
								length: SignUpPasswordMinLength,
							}),
						},
					},
					{
						fn: testApp.addCartPromocode,
						args: {
							body: {
								promocode: faker.string.uuid(),
							},
						},
					},
				);

				expect(addCartPromocodeLastRes.statusCode).toBe(429);
			});
		});
	});
});
