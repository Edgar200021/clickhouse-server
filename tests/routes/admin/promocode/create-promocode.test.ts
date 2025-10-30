import {faker} from "@faker-js/faker";
import type {LightMyRequestResponse} from "fastify";
import {describe, expect, it} from "vitest";
import {SignUpPasswordMinLength} from "../../../../src/const/zod.js";
import {PromocodeType, UserRole} from "../../../../src/types/db/db.js";
import {TestApp, withTestApp} from "../../../testApp.js";

describe("Admin", () => {
	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({length: SignUpPasswordMinLength}),
	};


	async function setup(testApp: TestApp) {
		return await testApp.app.kysely
			.selectFrom("promocode")
			.selectAll()
			.execute()
	}

	describe("Create Promocode", () => {
		it("Should return 201 status code when request is successful", async () => {
			await withTestApp(async testApp => {
				const createPromocodeRes = await testApp.withSignIn(
					{body: user},
					{
						fn: testApp.createPromocode,
						args: {
							body: {
								code: faker.string.sample(),
								type: PromocodeType.Percent,
								discountValue: 90,
								usageLimit: 10,
								validFrom: faker.date.soon({days: 1}),
								validTo: faker.date.future(),
							},
						},
					},
					UserRole.Admin,
				);

				expect(createPromocodeRes.statusCode).toBe(201);
			})
		});

		it("Should save into database when request is successful", async () => {
			await withTestApp(async testApp => {
				const code = faker.string.sample();
				const createPromocodeRes = await testApp.withSignIn(
					{body: user},
					{
						fn: testApp.createPromocode,
						args: {
							body: {
								code,
								type: PromocodeType.Percent,
								discountValue: 90,
								usageLimit: 10,
								validFrom: faker.date.soon({days: 1}),
								validTo: faker.date.future(),
							},
						},
					},
					UserRole.Admin,
				);

				expect(createPromocodeRes.statusCode).toBe(201);

				const dbPromocode = await testApp.app.kysely
					.selectFrom("promocode")
					.where("code", "=", code)
					.selectAll()
					.executeTakeFirst();

				expect(dbPromocode).toBeDefined();
			})
		});

		it("Should return 400 status code when data is invalid", async () => {
			await withTestApp(async testApp => {
				const promocodes = await setup(testApp)
				const testCases = [
					{
						name: "Missing code",
						data: {
							type: PromocodeType.Percent,
							discountValue: 90,
							usageLimit: 10,
							validFrom: faker.date.soon({days: 1}),
							validTo: faker.date.future(),
						},
					},
					{
						name: "When promocode with provided code already exists",
						data: {
							code: promocodes[0].code,
							type: PromocodeType.Percent,
							discountValue: 90,
							usageLimit: 10,
							validFrom: faker.date.soon({days: 1}),
							validTo: faker.date.future(),
						},
					},
					{
						name: "Missing type",
						data: {
							code: faker.string.sample(),
							discountValue: 90,
							usageLimit: 10,
							validFrom: faker.date.soon({days: 1}),
							validTo: faker.date.future(),
						},
					},
					{
						name: "Invalid type",
						data: {
							code: faker.string.sample(),
							type: "invalid type",
							discountValue: 90,
							usageLimit: 10,
							validFrom: faker.date.soon({days: 1}),
							validTo: faker.date.future(),
						},
					},
					{
						name: "Missing discount value",
						data: {
							code: faker.string.sample(),
							type: PromocodeType.Percent,
							usageLimit: 10,
							validFrom: faker.date.soon({days: 1}),
							validTo: faker.date.future(),
						},
					},
					{
						name: `Invalid discount value when type is ${PromocodeType.Percent}`,
						data: {
							code: faker.string.sample(),
							type: PromocodeType.Percent,
							discountValue: 100,
							usageLimit: 10,
							validFrom: faker.date.soon({days: 1}),
							validTo: faker.date.future(),
						},
					},
					{
						name: "Missing usage limit",
						data: {
							code: faker.string.sample(),
							type: PromocodeType.Percent,
							discountValue: 90,
							validFrom: faker.date.soon({days: 1}),
							validTo: faker.date.future(),
						},
					},
					{
						name: "Missing valid from",
						data: {
							code: faker.string.sample(),
							type: PromocodeType.Percent,
							discountValue: 90,
							usageLimit: 10,
							validTo: faker.date.future(),
						},
					},
					{
						name: "Missing valid to",
						data: {
							code: faker.string.sample(),
							type: PromocodeType.Fixed,
							discountValue: 90,
							usageLimit: 10,
							validFrom: faker.date.soon({days: 1}),
						},
					},
					{
						name: "Invalid valid from",
						data: {
							code: faker.string.sample(),
							type: PromocodeType.Percent,
							discountValue: 90,
							usageLimit: 10,
							validFrom: "10/01/2025",
							validTo: faker.date.future(),
						},
					},
					{
						name: "Invalid valid to",
						data: {
							code: faker.string.sample(),
							type: PromocodeType.Percent,
							discountValue: 90,
							usageLimit: 10,
							validFrom: faker.date.soon({days: 1}),
							validTo: "10/01/2025",
						},
					},
					{
						name: "ValidFrom after ValidTo",
						data: {
							code: faker.string.sample(),
							type: PromocodeType.Percent,
							discountValue: 90,
							usageLimit: 10,
							validFrom: faker.date.future({years: 1}),
							validTo: faker.date.soon({days: 1}),
						},
					},
					{
						name: "ValidTo in the past",
						data: {
							code: faker.string.sample(),
							type: PromocodeType.Percent,
							discountValue: 90,
							usageLimit: 10,
							validFrom: faker.date.past({years: 2}),
							validTo: faker.date.past({years: 1}),
						},
					},
				];
				const responses = await testApp.withSignIn(
					{body: user},
					testCases.map((body) => ({
						fn: testApp.createPromocode,
						args: {
							body: body.data,
						},
					})),
					UserRole.Admin,
				);

				for (const response of responses as unknown as LightMyRequestResponse[]) {
					expect(response.statusCode).toBe(400);
				}
			})
		});

		it("Should return 401 status code when user is not authorized", async () => {
			await withTestApp(async testApp => {
				const createPromocodeRes = await testApp.createPromocode({});
				expect(createPromocodeRes.statusCode).toBe(401);
			})
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			await withTestApp(async testApp => {
				const createPromocodeRes = await testApp.withSignIn(
					{body: user},
					{
						fn: testApp.createPromocode,
					},
				);
				expect(createPromocodeRes.statusCode).toBe(403);
			})
		});
	});
});