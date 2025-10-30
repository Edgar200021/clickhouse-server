import {faker} from "@faker-js/faker/locale/ur";
import {describe, expect, it} from "vitest";
import {SignUpPasswordMinLength} from "../../../../src/const/zod.js";
import {UserRole} from "../../../../src/types/db/db.js";
import {TestApp, type WithSignIn, withTestApp} from "../../../testApp.js";

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

	describe("Delete Promocode", () => {
		it("Should return 200 status code when request is successful", async () => {
			await withTestApp(async testApp => {
				const promocodes = await setup(testApp)
				const deletePromocodeRes = await testApp.withSignIn<
					Parameters<typeof testApp.deletePromocode>["1"][],
					WithSignIn<Parameters<typeof testApp.deletePromocode>["1"][]>
				>(
					{body: user},
					{
						fn: testApp.deletePromocode,
						additionalArg: [promocodes[0].id],
					},
					UserRole.Admin,
				);

				expect(deletePromocodeRes.statusCode).toBe(200);
			})
		});

		it("Should be deleted from database when request is successful", async () => {
			await withTestApp(async testApp => {
				const promocodes = await setup(testApp)
				await testApp.withSignIn<
					Parameters<typeof testApp.deletePromocode>["1"][],
					WithSignIn<Parameters<typeof testApp.deletePromocode>["1"][]>
				>(
					{body: user},
					{
						fn: testApp.deletePromocode,
						additionalArg: [promocodes[0].id],
					},
				);

				const dbPromocode = await testApp.app.kysely
					.selectFrom("promocode")
					.where("id", "=", promocodes[0].id)
					.selectAll()
					.execute();

				expect(dbPromocode).toBeUndefined;
			})
		});

		it("Should return 400 status code when data is invalid", async () => {
			await withTestApp(async testApp => {
				const deletePromocodeRes = await testApp.withSignIn<
					Parameters<typeof testApp.deletePromocode>["1"][],
					WithSignIn<Parameters<typeof testApp.deletePromocode>["1"][]>
				>(
					{body: user},
					{
						fn: testApp.deletePromocode,
						additionalArg: [
							"invalidid" as unknown as Parameters<
								typeof testApp.deletePromocode
							>["1"],
						],
					},
					UserRole.Admin,
				);

				expect(deletePromocodeRes.statusCode).toBe(400);
			})
		});

		it("Should return 401 status code when user is not authorized", async () => {
			await withTestApp(async testApp => {
				const promocodes = await setup(testApp)
				const deletePromocodeRes = await testApp.deletePromocode(
					{},
					promocodes[0].id,
				);

				expect(deletePromocodeRes.statusCode).toBe(401);
			})
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			await withTestApp(async testApp => {
				const promocodes = await setup(testApp)
				const deletePromocodeRes = await testApp.withSignIn<
					Parameters<typeof testApp.deletePromocode>["1"][],
					WithSignIn<Parameters<typeof testApp.deletePromocode>["1"][]>
				>(
					{body: user},
					{
						fn: testApp.deletePromocode,
						additionalArg: [promocodes[0].id],
					},
				);

				expect(deletePromocodeRes.statusCode).toBe(403);
			})
		});

		it("Should return 404 status code when promocode doesn't exist", async () => {
			await withTestApp(async testApp => {
				const promocodes = await setup(testApp)
				const deletePromocodeRes = await testApp.withSignIn<
					Parameters<typeof testApp.deletePromocode>["1"][],
					WithSignIn<Parameters<typeof testApp.deletePromocode>["1"][]>
				>(
					{body: user},
					{
						fn: testApp.deletePromocode,
						additionalArg: [Math.max(...promocodes.map((p) => p.id)) + 1],
					},
					UserRole.Admin,
				);

				expect(deletePromocodeRes.statusCode).toBe(404);
			})
		});
	});
});