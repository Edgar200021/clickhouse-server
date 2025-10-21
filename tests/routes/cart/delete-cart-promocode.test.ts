import { faker } from "@faker-js/faker";
import { constructNow, isWithinInterval } from "date-fns";
import type { LightMyRequestResponse } from "fastify";
import { describe, expect, it } from "vitest";
import { SignUpPasswordMinLength } from "../../../src/const/zod.js";
import type { Promocode } from "../../../src/types/db/promocode.js";
import { buildTestApp } from "../../testApp.js";

describe("Cart", () => {
	let testApp: Awaited<ReturnType<typeof buildTestApp>>;
	let promocodes: Pick<Promocode, "id" | "code" | "validFrom" | "validTo">[] =
		[];
	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({ length: SignUpPasswordMinLength }),
	};

	beforeEach(async () => {
		testApp = await buildTestApp();

		const promocode = await testApp.app.kysely
			.selectFrom("promocode")
			.select(["id", "code", "validFrom", "validTo"])
			.execute();

		promocodes = promocode;
	});

	const getValidPromocode = (): Pick<
		Promocode,
		"id" | "code" | "validFrom" | "validTo"
	> => {
		return promocodes.find((p) => {
			const now = constructNow(undefined);

			return isWithinInterval(now, { start: p.validFrom, end: p.validTo });
		})!;
	};

	afterEach(async () => {
		await testApp.close();
	});

	describe("Delete Cart Promocode", () => {
		it("Should return 200 status code when request is successful", async () => {
			const addCartPromocodeRes = await testApp.withSignIn(
				{ body: user },
				{
					fn: testApp.addCartPromocode,
					args: {
						body: {
							promocode: getValidPromocode().code,
						},
					},
				},
			);
			expect(addCartPromocodeRes.statusCode).toBe(200);

			const cookie = addCartPromocodeRes.cookies.find(
				(c) => c.name === testApp.app.config.application.sessionCookieName,
			);
			expect(cookie).toBeDefined();

			const deleteCartPromocodeRes = await testApp.deleteCartPromocode({
				cookies: {
					[cookie!.name]: cookie!.value,
				},
			});
			expect(deleteCartPromocodeRes.statusCode).toBe(200);
		});

		it("Should remove promocode from database when request is successfull", async () => {
			const validPromocode = getValidPromocode();
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

			const cookie = addCartPromocodeRes.cookies.find(
				(c) => c.name === testApp.app.config.application.sessionCookieName,
			);
			expect(cookie).toBeDefined();

			const deleteCartPromocodeRes = await testApp.deleteCartPromocode({
				cookies: {
					[cookie!.name]: cookie!.value,
				},
			});
			expect(deleteCartPromocodeRes.statusCode).toBe(200);

			const cart = await testApp.app.kysely
				.selectFrom("cart")
				.innerJoin("users", "users.id", "cart.userId")
				.leftJoin("promocode", "promocode.id", "cart.promocodeId")
				.select(["promocode.id as promocodeId"])
				.where("users.email", "=", user.email.toLowerCase())
				.executeTakeFirst();

			expect(cart).toBeDefined();
			expect(cart?.promocodeId).toBeNull();
		});

		it("Should return 400 status code when cart doesn't have a promocode", async () => {
			const deleteCartPromocodeRes = await testApp.withSignIn(
				{
					body: user,
				},
				{
					fn: testApp.deleteCartPromocode,
				},
			);

			expect(deleteCartPromocodeRes.statusCode).toBe(400);
		});

		it("Should return 401 status code when user is not authorized", async () => {
			const deleteCartPromocodeRes = await testApp.deleteCartPromocode();

			expect(deleteCartPromocodeRes.statusCode).toBe(401);
		});

		it("Should be rate limited", async () => {
			const responses = await testApp.withSignIn(
				{
					body: user,
				},
				Array.from({
					length: testApp.app.config.rateLimit.deleteCartPromocodeLimit!,
				}).map(() => ({
					fn: testApp.deleteCartPromocode,
				})),
			);

			for (const res of responses as unknown as LightMyRequestResponse[]) {
				expect(res.statusCode).toBe(400);
			}

			const cookie = (
				responses as unknown as LightMyRequestResponse[]
			)[0].cookies.find(
				(c) => c.name === testApp.app.config.application.sessionCookieName,
			);
			expect(cookie).toBeDefined();

			const deleteCartPromocodeLastRes = await testApp.deleteCartPromocode({
				cookies: {
					[cookie!.name]: cookie!.value,
				},
			});
			expect(deleteCartPromocodeLastRes.statusCode).toBe(429);
		});
	});
});
