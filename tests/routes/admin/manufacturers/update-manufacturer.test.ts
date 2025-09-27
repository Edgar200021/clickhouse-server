import { faker } from "@faker-js/faker";
import type { LightMyRequestResponse } from "fastify";
import { describe, expect, it } from "vitest";
import {
	ManufacturerNameMaxLength,
	SignUpPasswordMinLength,
} from "../../../../src/const/zod.js";
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

	describe("Update Manufacturer", () => {
		it("Should return 200 status code when request is successfull", async () => {
			const updateManufacturerRes = await testApp.withSignIn<
				Parameters<typeof testApp.updateManufacturer>["1"][],
				WithSignIn<Parameters<typeof testApp.updateManufacturer>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.updateManufacturer,
					args: {
						body: {
							name: faker.string.sample(),
						},
					},
					additionalArg: [manufacturers[0].id],
				},
				UserRole.Admin,
			);

			expect(updateManufacturerRes.statusCode).toBe(200);
		});

		it("Should change manufacturer in database when request is successfull", async () => {
			const name = faker.string.sample();
			const updateManufacturerRes = await testApp.withSignIn<
				Parameters<typeof testApp.updateManufacturer>["1"][],
				WithSignIn<Parameters<typeof testApp.updateManufacturer>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.updateManufacturer,
					args: {
						body: {
							name,
						},
					},
					additionalArg: [manufacturers[0].id],
				},
				UserRole.Admin,
			);

			expect(updateManufacturerRes.statusCode).toBe(200);

			const dbManufacturer = await testApp.app.kysely
				.selectFrom("manufacturer")
				.selectAll()
				.where("id", "=", manufacturers[0].id)
				.executeTakeFirst();

			expect(dbManufacturer).toBeDefined;
			expect(dbManufacturer?.name !== manufacturers[0].name);
			expect(dbManufacturer?.name === name);
		});

		it("Should return 400 status code when data is invalid", async () => {
			const testCases = [
				{
					name: 123,
				},
				{},
				{
					name: faker.string.alpha({ length: ManufacturerNameMaxLength + 1 }),
				},
				{
					name: undefined,
				},
				{ name: null },
			];
			const responses = await testApp.withSignIn<
				Parameters<typeof testApp.updateManufacturer>["1"][],
				WithSignIn<Parameters<typeof testApp.updateManufacturer>["1"][]>[]
			>(
				{ body: user },
				testCases.map((body) => ({
					fn: testApp.updateManufacturer,
					args: {
						body,
					},
					additionalArg: [manufacturers[0].id],
				})),
				UserRole.Admin,
			);

			for (const response of responses as unknown as LightMyRequestResponse[])
				expect(response.statusCode).toBe(400);
		});

		it("Should return 400 status code when manufacturer already exists", async () => {
			const updateManufacturerRes = await testApp.withSignIn<
				Parameters<typeof testApp.updateManufacturer>["1"][],
				WithSignIn<Parameters<typeof testApp.updateManufacturer>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.updateManufacturer,
					args: {
						body: {
							name: manufacturers[1].name,
						},
					},
					additionalArg: [manufacturers[0].id],
				},
				UserRole.Admin,
			);

			expect(updateManufacturerRes.statusCode).toBe(400);
		});

		it("Should return 401 status code when user is not authorized", async () => {
			const manufacturerRes = await testApp.updateManufacturer(
				{},
				manufacturers[0].id,
			);

			expect(manufacturerRes.statusCode).toBe(401);
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			const manufacturerRes = await testApp.withSignIn<
				Parameters<typeof testApp.updateManufacturer>["1"][],
				WithSignIn<Parameters<typeof testApp.updateManufacturer>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.updateManufacturer,
					additionalArg: [manufacturers[0].id],
				},
			);

			expect(manufacturerRes.statusCode).toBe(403);
		});

		it("Should return 404 status code when manufacturer doesn't exist", async () => {
			const updateManufacturerRes = await testApp.withSignIn<
				Parameters<typeof testApp.updateManufacturer>["1"][],
				WithSignIn<Parameters<typeof testApp.updateManufacturer>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.updateManufacturer,
					args: {
						body: {
							name: faker.string.sample(),
						},
					},
					additionalArg: [Math.max(...manufacturers.map((v) => v.id)) + 1],
				},
				UserRole.Admin,
			);

			expect(updateManufacturerRes.statusCode).toBe(404);
		});
	});
});
