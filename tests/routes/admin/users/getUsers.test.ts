import { faker } from "@faker-js/faker/locale/ur";
import { describe, expect, it } from "vitest";
import type z from "zod";
import {
	GetUsersMaxLimit,
	SignUpPasswordMinLength,
} from "../../../../src/const/zod.js";
import type { AdminUserSchema } from "../../../../src/schemas/user/user.schema.js";
import { UserRole } from "../../../../src/types/db/db.js";
import type { User } from "../../../../src/types/db/user.js";
import { buildTestApp } from "../../../testApp.js";

describe("Admin", () => {
	let testApp: Awaited<ReturnType<typeof buildTestApp>>;
	let insertedUsers: User[] = [];
	const user = {
		email: faker.internet.email(),
		password: faker.internet.password({ length: SignUpPasswordMinLength }),
	};

	beforeEach(async () => {
		testApp = await buildTestApp();

		const inserted = await testApp.app.kysely
			.insertInto("users")
			.values([
				{
					email: faker.internet.email(),
					password: faker.internet.password({
						length: SignUpPasswordMinLength,
					}),
					isBanned: true,
				},
				{
					email: faker.internet.email(),
					password: faker.internet.password({
						length: SignUpPasswordMinLength,
					}),
				},
				{
					email: faker.internet.email(),
					password: faker.internet.password({
						length: SignUpPasswordMinLength,
					}),
					isVerified: true,
				},
				{
					email: faker.internet.email(),
					password: faker.internet.password({
						length: SignUpPasswordMinLength,
					}),
					isVerified: true,
				},
				{
					email: faker.internet.email(),
					password: faker.internet.password({
						length: SignUpPasswordMinLength,
					}),
					role: UserRole.Admin,
				},
			])
			.returningAll()
			.execute();

		insertedUsers = inserted;
	});

	afterEach(async () => {
		await testApp.close();
	});

	describe("Get Users", () => {
		it("Should return 200 status code when request is successfull", async () => {
			const getUsersRes = await testApp.withSignIn(
				{ body: user },
				{ fn: testApp.getUsers },
				UserRole.Admin,
			);
			const {
				data: { totalCount, users },
			} = getUsersRes.json<{
				status: "success";
				data: { totalCount: number; users: z.Infer<typeof AdminUserSchema>[] };
			}>();

			expect(getUsersRes.statusCode).toBe(200);
			expect(totalCount).toBe(
				insertedUsers.filter((u) => u.role !== UserRole.Admin).length,
			);
			expect(users).toHaveLength(
				insertedUsers.filter((u) => u.role !== UserRole.Admin).length,
			);
		});

		it("Should filter users by isBanned and isVerified", async () => {
			const queries: ({ isBanned: "true" } | { isVerified: "true" })[] = [
				{ isBanned: "true" },
				{ isVerified: "true" },
			];

			for (const query of queries) {
				const res = await testApp.withSignIn(
					{
						body: {
							email: faker.internet.email(),
							password: faker.internet.password({
								length: SignUpPasswordMinLength,
							}),
						},
					},
					{ fn: testApp.getUsers, args: { query } },
					UserRole.Admin,
				);

				expect(res.statusCode).toBe(200);

				const {
					data: { totalCount, users },
				} = res.json<{
					status: "success";
					data: {
						totalCount: number;
						users: z.infer<typeof AdminUserSchema>[];
					};
				}>();

				expect(totalCount).toBe(
					insertedUsers.filter(
						(u) =>
							(Object.hasOwn(query, "isBanned") ? u.isBanned : u.isVerified) &&
							u.role !== UserRole.Admin,
					).length,
				);
				expect(
					users.every((u) =>
						Object.hasOwn(query, "isBanned") ? u.isBanned : u.isVerified,
					),
				).toBe(true);
			}
		});

		it("Should filter users by search (case-insensitive, substring)", async () => {
			const firstNonAdmin = insertedUsers.find(
				(u) => u.role !== UserRole.Admin,
			);
			if (!firstNonAdmin) throw new Error("No non-admin user found for test");

			const email = firstNonAdmin.email;
			const partLower = email.slice(0, 4);
			const partUpper = partLower.toUpperCase();

			const queries = [
				{ search: partLower, expected: true },
				{ search: partUpper, expected: true },
				{ search: "no-such-email", expected: false },
			];

			for (const { search, expected } of queries) {
				const res = await testApp.withSignIn(
					{
						body: {
							email: faker.internet.email(),
							password: faker.internet.password({
								length: SignUpPasswordMinLength,
							}),
						},
					},
					{ fn: testApp.getUsers, args: { query: { search } } },
					UserRole.Admin,
				);

				expect(res.statusCode).toBe(200);
				const {
					data: { totalCount, users },
				} = res.json<{
					status: "success";
					data: {
						totalCount: number;
						users: z.infer<typeof AdminUserSchema>[];
					};
				}>();

				if (expected) {
					expect(totalCount).toBeGreaterThan(0);
					expect(users.some((u) => u.email === email)).toBe(true);
				} else {
					expect(users.some((u) => u.email === email)).toBe(false);
				}
			}
		});

		it("Should return 400 status code when filters are invalid", async () => {
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
					limit: GetUsersMaxLimit + 1,
				},
				{
					search: "",
				},
			];

			const responses = await testApp.withSignIn(
				{ body: user },
				testCases.map((t) => ({
					fn: testApp.getUsers,
					args: { query: t as unknown as Record<string, string> },
				})),
				UserRole.Admin,
			);

			for (const response of responses as LightMyRequestResponse[]) {
				expect(response.statusCode).toBe(400);
			}
		});

		it("Should return 401 status code when user is not authorized", async () => {
			const getManufacturerRes = await testApp.getUsers({});
			expect(getManufacturerRes.statusCode).toBe(401);
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			const getManufacturerRes = await testApp.withSignIn(
				{ body: user },
				{
					fn: testApp.getUsers,
				},
			);
			expect(getManufacturerRes.statusCode).toBe(403);
		});
	});
});
