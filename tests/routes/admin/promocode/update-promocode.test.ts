import { faker } from "@faker-js/faker";
import type { LightMyRequestResponse } from "fastify";
import { describe, expect, it } from "vitest";
import { SignUpPasswordMinLength } from "../../../../src/const/zod.js";
import { PromocodeType, UserRole } from "../../../../src/types/db/db.js";
import type { Promocode } from "../../../../src/types/db/promocode.js";
import { buildTestApp, type WithSignIn } from "../../../testApp.js";

describe("Admin", () => {
	let testApp: Awaited<ReturnType<typeof buildTestApp>>;
	let promocodes: Promocode[];

	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({ length: SignUpPasswordMinLength }),
	};

	beforeEach(async () => {
		testApp = await buildTestApp();
		promocodes = await testApp.app.kysely
			.selectFrom("promocode")
			.selectAll()
			.execute();
	});

	afterEach(async () => await testApp.close());

	describe("Update Promocode", () => {
		it("Should return 200 status code when request is successfull", async () => {
			const updatePromocodeRes = await testApp.withSignIn<
				Parameters<typeof testApp.updatePromocode>["1"][],
				WithSignIn<Parameters<typeof testApp.updatePromocode>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.updatePromocode,
					args: {
						body: {
							code: faker.string.sample(),
						},
					},
					additionalArg: [promocodes[0].id],
				},
				UserRole.Admin,
			);

			expect(updatePromocodeRes.statusCode).toBe(200);
		});

		it("Should apply change into database when request is successful", async () => {
			const code = faker.string.sample();
			const updatePromocodeRes = await testApp.withSignIn<
				Parameters<typeof testApp.updatePromocode>["1"][],
				WithSignIn<Parameters<typeof testApp.updatePromocode>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.updatePromocode,
					args: {
						body: {
							code,
						},
					},
					additionalArg: [promocodes[0].id],
				},
				UserRole.Admin,
			);

			expect(updatePromocodeRes.statusCode).toBe(200);

			const dbPromocode = await testApp.app.kysely
				.selectFrom("promocode")
				.where("id", "=", promocodes[0].id)
				.selectAll()
				.executeTakeFirst();

			expect(dbPromocode).toBeDefined();
			expect(dbPromocode!.code).toEqual(code);
			expect(dbPromocode!.code).not.toEqual(promocodes[0].code);
		});

		it("Should return 400 status code when data is invalid", async () => {
			const promocodeWithPercentType = promocodes.find(
				(p) => p.type === PromocodeType.Percent,
			);
			expect(promocodeWithPercentType).toBeDefined();

			const testCases = [
				{
					name: "Empty body",
					data: {},
				},
				{
					name: "No new data",
					data: {
						code: promocodeWithPercentType!.code,
						discountValue: promocodeWithPercentType!.discountValue,
						usageLimit: promocodeWithPercentType!.usageLimit,
						validFrom: promocodeWithPercentType!.validFrom,
						validTo: promocodeWithPercentType!.validTo,
					},
				},
				{
					name: "When promocode with provided code already exists",
					data: {
						code: promocodes.filter(
							(p) => p.id !== promocodeWithPercentType!.id,
						)[0].code,
					},
				},
				{
					name: "Invalid type",
					data: {
						type: "invalid type",
					},
				},
				{
					name: `Invalid discount value when type is ${PromocodeType.Percent}`,
					data: {
						type: PromocodeType.Percent,
						discountValue: 100,
					},
				},
				{
					name: `Invalid discount value when type is already ${PromocodeType.Percent}`,
					data: {
						discountValue: 100,
					},
				},
				{
					name: "Invalid valid from",
					data: {
						validFrom: "10/01/2025",
					},
				},
				{
					name: "Invalid valid to",
					data: {
						validTo: "10/01/2025",
					},
				},
				{
					name: "ValidFrom after ValidTo",
					data: {
						validFrom: faker.date.future({ years: 1 }),
						validTo: faker.date.soon({ days: 1 }),
					},
				},
				{
					name: "ValidTo in the past",
					data: {
						validFrom: faker.date.past({ years: 2 }),
						validTo: faker.date.past({ years: 1 }),
					},
				},
				{
					name: "ValidFrom after database ValidTo",
					data: {
						validFrom: faker.date.future({
							refDate: promocodeWithPercentType!.validTo,
						}),
					},
				},

				{
					name: "ValidTo before database ValidFrom",
					data: {
						validTo: faker.date.past({
							refDate: promocodeWithPercentType!.validTo,
						}),
					},
				},
			];

			const responses = await testApp.withSignIn<
				Parameters<typeof testApp.updatePromocode>["1"][],
				WithSignIn<Parameters<typeof testApp.updatePromocode>["1"][]>[]
			>(
				{ body: user },
				testCases.map((body) => ({
					fn: testApp.updatePromocode,
					args: {
						body: body.data,
					},
					additionalArg: [promocodeWithPercentType!.id],
				})),
				UserRole.Admin,
			);

			for (const response of responses as unknown as LightMyRequestResponse[]) {
				expect(response.statusCode).toBe(400);
			}
		});

		it("Should return 401 status code when user is not authorized", async () => {
			const updatePromocodeRes = await testApp.updatePromocode(
				{},
				promocodes[0].id,
			);
			expect(updatePromocodeRes.statusCode).toBe(401);
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			const updatePromocodeRes = await testApp.withSignIn<
				Parameters<typeof testApp.updatePromocode>["1"][],
				WithSignIn<Parameters<typeof testApp.updatePromocode>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.updatePromocode,
					additionalArg: [promocodes[0].id],
				},
			);
			expect(updatePromocodeRes.statusCode).toBe(403);
		});
	});
});
