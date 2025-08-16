import { faker } from "@faker-js/faker";
import type { LightMyRequestResponse } from "fastify";
import { describe, expect, it } from "vitest";
import {
	ManufacturerNameMaxLength,
	SignUpPasswordMinLength,
} from "../../../../src/const/zod.js";
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

	describe("Create Manufacturer", () => {
		it("Should return 201 status code when request is successfull", async () => {
			const manufacturerRes = await testApp.withSignIn(
				{ body: user },
				{
					fn: testApp.createManufacturer,
					args: {
						body: {
							name: faker.string.sample(),
						},
					},
				},
				UserRole.Admin,
			);

			expect(manufacturerRes.statusCode).toBe(201);
		});

		it("Should save manufacturer into database when request is successfull", async () => {
			const name = faker.string.sample();
			const manufacturerRes = await testApp.withSignIn(
				{ body: user },
				{
					fn: testApp.createManufacturer,
					args: {
						body: {
							name,
						},
					},
				},
				UserRole.Admin,
			);
			expect(manufacturerRes.statusCode).toBe(201);

			const dbManufacturer = await testApp.app.kysely
				.selectFrom("manufacturer")
				.selectAll()
				.where("name", "=", name)
				.executeTakeFirst();

			expect(dbManufacturer).toBeDefined;
		});

		it("Should return 400 status code when data is invalid", async () => {
			const testCases = [
				{
					name: 123,
				},
				{
					name: faker.string.alpha({ length: ManufacturerNameMaxLength + 1 }),
				},
				{},
				{
					name: undefined,
				},
				{ name: null },
			];
			const responses = await testApp.withSignIn(
				{ body: user },
				testCases.map((body) => ({
					fn: testApp.createManufacturer,
					args: {
						body,
					},
				})),
				UserRole.Admin,
			);

			for (const response of responses as LightMyRequestResponse[])
				expect(response.statusCode).toBe(400);
		});

		it("Should return 400 status code when manufacturer already exists", async () => {
			const name = faker.string.sample();
			const [_, manufacturerRes] = await testApp.withSignIn(
				{ body: user },
				[
					{
						fn: testApp.createManufacturer,
						args: {
							body: {
								name,
							},
						},
					},
					{
						fn: testApp.createManufacturer,
						args: {
							body: {
								name,
							},
						},
					},
				],
				UserRole.Admin,
			);

			expect(manufacturerRes.statusCode).toBe(400);
		});

		it("Should return 401 status code when user is not authorized", async () => {
			const manufacturerRes = await testApp.createManufacturer();

			expect(manufacturerRes.statusCode).toBe(401);
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			const manufacturerRes = await testApp.withSignIn(
				{ body: user },
				{
					fn: testApp.createManufacturer,
				},
			);

			expect(manufacturerRes.statusCode).toBe(403);
		});
	});
});
