import {faker} from "@faker-js/faker";
import type {LightMyRequestResponse} from "fastify";
import {describe, expect, it} from "vitest";
import {GetPromocodesMaxLimit, SignUpPasswordMinLength,} from "../../../../src/const/zod.js";
import {UserRole} from "../../../../src/types/db/db.js";
import type {Promocode} from "../../../../src/types/db/promocode.js";
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

	describe("Get Promocodes", () => {
		it("Should return 200 status code when request is successful", async () => {
			await withTestApp(async testApp => {
				const getPromocodesResponse = await testApp.withSignIn(
					{body: user},
					{
						fn: testApp.getPromocodes,
					},
					UserRole.Admin,
				);

				console.log(getPromocodesResponse);

				expect(getPromocodesResponse.statusCode).toBe(200);
			})
		});

		it("Should return correct data when filters are valid", async () => {
			await withTestApp(async testApp => {
				const promocodes = await setup(testApp)
				const testCases = [
					{
						query: {limit: 5},
						expectedLength: 5,
					},
					{
						query: {
							limit:
								promocodes.length > GetPromocodesMaxLimit
									? GetPromocodesMaxLimit
									: promocodes.length,
						},
						expectedLength:
							promocodes.length > GetPromocodesMaxLimit
								? GetPromocodesMaxLimit
								: promocodes.length,
					},
					{
						query: {search: promocodes[0].code.slice(0, 4)},
						expectedLength: promocodes.filter((p) =>
							p.code.includes(promocodes[0].code.slice(0, 4)),
						).length,
					},
				];

				for (const testCase of testCases) {
					const getProductsRes = await testApp.withSignIn(
						{
							body: {
								email: faker.internet.email(),
								password: faker.internet.password({
									length: SignUpPasswordMinLength,
								}),
							},
						},
						{
							fn: testApp.getPromocodes,
							args: {
								query: testCase.query as unknown as Record<string, string>,
							},
						},
						UserRole.Admin,
					);

					expect(getProductsRes.statusCode).toBe(200);
					expect(
						getProductsRes.json<{
							status: "success";
							data: { promocodes: Promocode[]; pageCount: number };
						}>().data.promocodes.length,
					).toEqual(testCase.expectedLength);
				}
			})
		});

		it("Should return 400 status code when filters are invalid", async () => {
			await withTestApp(async testApp => {
				const testCases = [
					{
						limit: 0,
					},
					{
						page: 0,
					},
					{
						limit: -1,
					},
					{
						page: -1,
					},
					{
						limit: GetPromocodesMaxLimit + 1,
					},
					{
						search: "",
					},
				];
				const responses = await testApp.withSignIn(
					{body: user},
					testCases.map((query) => {
						return {
							fn: testApp.getPromocodes,
							args: {query: query as unknown as Record<string, string>},
						};
					}),
					UserRole.Admin,
				);
				for (const response of responses as unknown as LightMyRequestResponse[])
					expect(response.statusCode).toBe(400);

			})
		});

		it("Should return 401 status code when user is not authorized", async () => {
			await withTestApp(async testApp => {
				const getPromocodesRes = await testApp.getPromocodes({});
				expect(getPromocodesRes.statusCode).toBe(401);
			})
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			await withTestApp(async testApp => {
				const getPromocodesRes = await testApp.withSignIn(
					{body: user},
					{
						fn: testApp.getPromocodes,
					},
				);
				expect(getPromocodesRes.statusCode).toBe(403);
			})
		});
	});
});