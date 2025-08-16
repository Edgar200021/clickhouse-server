import { faker } from "@faker-js/faker";
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

	describe("Delete Manufacturer", () => {
		it("Should return 200 status code when request is successfull", async () => {
			const deleteManufacturerRes = await testApp.withSignIn<
				Parameters<typeof testApp.deleteManufacturer>["1"][],
				WithSignIn<Parameters<typeof testApp.deleteManufacturer>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.deleteManufacturer,
					additionalArg: [manufacturers[1].id],
				},
				UserRole.Admin,
			);

			expect(deleteManufacturerRes.statusCode).toBe(200);
		});

		it("Should be deleted from database when request is successfull", async () => {
			const deleteManufacturerRes = await testApp.withSignIn<
				Parameters<typeof testApp.deleteManufacturer>["1"][],
				WithSignIn<Parameters<typeof testApp.deleteManufacturer>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.deleteManufacturer,
					additionalArg: [manufacturers[1].id],
				},
				UserRole.Admin,
			);

			expect(deleteManufacturerRes.statusCode).toBe(200);

			const dbManufacturer = await testApp.app.kysely
				.selectFrom("manufacturer")
				.selectAll()
				.where("id", "=", manufacturers[0].id)
				.executeTakeFirst();

			expect(dbManufacturer).toBeUndefined;
		});

		it("should return 400 when deleting default manufacturer", async () => {
			const deleteManufacturerRes = await testApp.withSignIn<
				Parameters<typeof testApp.deleteManufacturer>["1"][],
				WithSignIn<Parameters<typeof testApp.deleteManufacturer>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.deleteManufacturer,
					additionalArg: [manufacturers[0].id],
				},
				UserRole.Admin,
			);

			expect(deleteManufacturerRes.statusCode).toBe(400);
		});

		it("Should return 400 status code when data is invalid", async () => {
			const deleteManufacturerRes = await testApp.withSignIn<
				Parameters<typeof testApp.deleteManufacturer>["1"][],
				WithSignIn<Parameters<typeof testApp.deleteManufacturer>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.deleteManufacturer,
					additionalArg: [
						"invalidid" as unknown as Parameters<
							typeof testApp.deleteManufacturer
						>["1"],
					],
				},
				UserRole.Admin,
			);

			expect(deleteManufacturerRes.statusCode).toBe(400);
		});

		it("Should return 401 status code when user is not authorized", async () => {
			const deleteManufacturerRes = await testApp.deleteManufacturer(
				{},
				manufacturers[0].id,
			);

			expect(deleteManufacturerRes.statusCode).toBe(401);
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			const deleteManufacturerRes = await testApp.withSignIn<
				Parameters<typeof testApp.deleteManufacturer>["1"][],
				WithSignIn<Parameters<typeof testApp.deleteManufacturer>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.deleteManufacturer,
					additionalArg: [manufacturers[0].id],
				},
			);

			expect(deleteManufacturerRes.statusCode).toBe(403);
		});

		it("Should return 404 status code when manufacturer doesn't exist", async () => {
			const deleteManufacturerRes = await testApp.withSignIn<
				Parameters<typeof testApp.deleteManufacturer>["1"][],
				WithSignIn<Parameters<typeof testApp.deleteManufacturer>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.deleteManufacturer,
					args: {
						body: {
							name: faker.string.sample(),
						},
					},
					additionalArg: [Math.max(...manufacturers.map((v) => v.id)) + 1],
				},
				UserRole.Admin,
			);

			expect(deleteManufacturerRes.statusCode).toBe(404);
		});
	});
});
