import { faker } from "@faker-js/faker";
import type { LightMyRequestResponse } from "fastify";
import { describe, expect, it } from "vitest";
import { SignUpPasswordMinLength } from "../../../../src/const/zod.js";
import { UserRole } from "../../../../src/types/db/db.js";
import type { Manufacturer } from "../../../../src/types/db/manufacturer.js";
import { buildTestApp, type WithSignIn } from "../../../testApp.js";

describe("Admin", () => {
	let testApp: Awaited<ReturnType<typeof buildTestApp>>;
	const manufacturers: Manufacturer[] = [];
	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({ length: SignUpPasswordMinLength }),
	};

	beforeEach(async () => {
		testApp = await buildTestApp();

		const values = await testApp.app.kysely
			.selectFrom("manufacturer")
			.selectAll()
			.execute();

		for (const val of values) {
			manufacturers.push(val);
		}
	});

	afterEach(async () => {
		await testApp.close();
		manufacturers.length = 0;
	});

	describe("Get Manufacturer", () => {
		it("Should return 200 status code when request is successfull", async () => {
			const getManufacturerRes = await testApp.withSignIn<
				Parameters<typeof testApp.getManufacturer>["1"][],
				WithSignIn<Parameters<typeof testApp.getManufacturer>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.getManufacturer,
					additionalArg: [manufacturers[0].id],
				},
				UserRole.Admin,
			);

			expect(getManufacturerRes.statusCode).toBe(200);
		});

		it("Should return 400 status code when data is invalid", async () => {
			const getManufacturerRes = await testApp.withSignIn<
				Parameters<typeof testApp.getManufacturer>["1"][],
				WithSignIn<Parameters<typeof testApp.getManufacturer>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.getManufacturer,
					additionalArg: [
						"invalidid" as unknown as Parameters<
							typeof testApp.deleteManufacturer
						>["1"],
					],
				},
				UserRole.Admin,
			);

			expect(getManufacturerRes.statusCode).toBe(400);
		});

		it("Should return 401 status code when user is not authorized", async () => {
			const getManufacturerRes = await testApp.getManufacturer(
				{},
				manufacturers[0].id,
			);

			expect(getManufacturerRes.statusCode).toBe(401);
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			const getManufacturerRes = await testApp.withSignIn<
				Parameters<typeof testApp.getManufacturer>["1"][],
				WithSignIn<Parameters<typeof testApp.getManufacturer>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.getManufacturer,
					additionalArg: [manufacturers[0].id],
				},
			);

			expect(getManufacturerRes.statusCode).toBe(403);
		});

		it("Should return 404 status code when manufacturer doesn't exist", async () => {
			const getManufacturerRes = await testApp.withSignIn<
				Parameters<typeof testApp.getManufacturer>["1"][],
				WithSignIn<Parameters<typeof testApp.getManufacturer>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.getManufacturer,
					args: {
						body: {
							name: faker.string.sample(),
						},
					},
					additionalArg: [Math.max(...manufacturers.map((v) => v.id)) + 1],
				},
				UserRole.Admin,
			);

			expect(getManufacturerRes.statusCode).toBe(404);
		});
	});
});
