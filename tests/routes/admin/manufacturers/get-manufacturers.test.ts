import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { SignUpPasswordMinLength } from "../../../../src/const/zod.js";
import { UserRole } from "../../../../src/types/db/db.js";
import { buildTestApp } from "../../../testApp.js";

describe("Admin", () => {
	let testApp: Awaited<ReturnType<typeof buildTestApp>>;
	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({ length: SignUpPasswordMinLength }),
	};

	beforeEach(async () => {
		testApp = await buildTestApp();
	});

	afterEach(async () => {
		await testApp.close();
	});

	describe("Get Manufacturers", () => {
		it("Should return 200 status code when request is successfull", async () => {
			const manufacturerRes = await testApp.withSignIn(
				{ body: user },
				{
					fn: testApp.getManufacturers,
				},
				UserRole.Admin,
			);

			expect(manufacturerRes.statusCode).toBe(200);
		});

		it("Should return 401 status code when user is not authorized", async () => {
			const manufacturerRes = await testApp.getManufacturers();

			expect(manufacturerRes.statusCode).toBe(401);
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			const manufacturerRes = await testApp.withSignIn(
				{ body: user },
				{
					fn: testApp.getManufacturers,
				},
			);

			expect(manufacturerRes.statusCode).toBe(403);
		});
	});
});
