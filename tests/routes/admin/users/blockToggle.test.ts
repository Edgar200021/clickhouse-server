import { faker } from "@faker-js/faker";
import type { LightMyRequestResponse } from "fastify";
import { describe, expect, it } from "vitest";
import { SignUpPasswordMinLength } from "../../../../src/const/zod.js";
import { UserRole } from "../../../../src/types/db/db.js";
import type { User } from "../../../../src/types/db/user.js";
import { buildTestApp, type WithSignIn } from "../../../testApp.js";

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
			])
			.returningAll()
			.execute();

		insertedUsers = inserted;
	});

	afterEach(async () => {
		await testApp.close();
	});

	describe("Block Toggle", () => {
		it("Should return 200 status code when request is successfull", async () => {
			const blockToggleRes = await testApp.withSignIn<
				Parameters<typeof testApp.blockToggle>["1"][],
				WithSignIn<Parameters<typeof testApp.blockToggle>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.blockToggle,
					args: {
						body: { type: insertedUsers[0].isBanned ? "unlock" : "lock" },
					},
					additionalArg: [insertedUsers[0].id],
				},
				UserRole.Admin,
			);

			expect(blockToggleRes.statusCode).toBe(200);
		});

		it("Should change isBanned column in users table when request is successfull", async () => {
			const u = insertedUsers.find((u) => !u.isBanned);
			if (!u) throw new Error("User not found");

			const blockToggleRes = await testApp.withSignIn<
				Parameters<typeof testApp.blockToggle>["1"][],
				WithSignIn<Parameters<typeof testApp.blockToggle>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.blockToggle,
					args: {
						body: { type: "lock" },
					},
					additionalArg: [u?.id],
				},
				UserRole.Admin,
			);

			expect(blockToggleRes.statusCode).toBe(200);

			const dbUser = await testApp.app.kysely
				.selectFrom("users")
				.select("isBanned")
				.where("id", "=", u.id)
				.executeTakeFirstOrThrow();

			expect(dbUser.isBanned).toBe(true);
		});

		it("Should return 400 status code when data is invalid", async () => {
			const testCases = [
				{
					type: "",
				},
				{
					type: 12,
				},
				{
					type: undefined,
				},
				{
					type: null,
				},
				undefined,
			];

			const responses = await testApp.withSignIn<
				Parameters<typeof testApp.blockToggle>["1"][],
				WithSignIn<Parameters<typeof testApp.blockToggle>["1"][]>[]
			>(
				{ body: user },
				testCases.map((body) => {
					return {
						fn: testApp.blockToggle,
						args: {
							body,
						},
						additionalArg: [insertedUsers[0].id],
					};
				}),
				UserRole.Admin,
			);

			for (const response of responses as LightMyRequestResponse[])
				expect(response.statusCode).toBe(400);
		});

		it("Should return 400 status code when type is lock and user is already banned", async () => {
			const blockToggleRes = await testApp.withSignIn<
				Parameters<typeof testApp.blockToggle>["1"][],
				WithSignIn<Parameters<typeof testApp.blockToggle>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.blockToggle,
					args: {
						body: { type: "lock" },
					},
					additionalArg: [insertedUsers.find((u) => u.isBanned)?.id],
				},
				UserRole.Admin,
			);

			expect(blockToggleRes.statusCode).toBe(400);
		});

		it("Should return 400 status code when type is unlock and user is already unbanned", async () => {
			const blockToggleRes = await testApp.withSignIn<
				Parameters<typeof testApp.blockToggle>["1"][],
				WithSignIn<Parameters<typeof testApp.blockToggle>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.blockToggle,
					args: {
						body: { type: "unlock" },
					},
					additionalArg: [insertedUsers.find((u) => !u.isBanned)?.id],
				},
				UserRole.Admin,
			);

			expect(blockToggleRes.statusCode).toBe(400);
		});

		it("Should return 401 status code when user is not authorized", async () => {
			const blockToggleRes = await testApp.blockToggle({}, insertedUsers[0].id);

			expect(blockToggleRes.statusCode).toBe(401);
		});

		it(`Should return 403 status code when user role is not ${UserRole.Admin}`, async () => {
			const blockToggleRes = await testApp.withSignIn<
				Parameters<typeof testApp.blockToggle>["1"][],
				WithSignIn<Parameters<typeof testApp.blockToggle>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.blockToggle,
					args: { body: { type: "lock" } },
					additionalArg: [insertedUsers[0].id],
				},
			);

			expect(blockToggleRes.statusCode).toBe(403);
		});

		it(`Should return 404 status code when user is not found`, async () => {
			const blockToggleRes = await testApp.withSignIn<
				Parameters<typeof testApp.blockToggle>["1"][],
				WithSignIn<Parameters<typeof testApp.blockToggle>["1"][]>
			>(
				{ body: user },
				{
					fn: testApp.blockToggle,
					args: { body: { type: "lock" } },
					additionalArg: [faker.string.uuid()],
				},
				UserRole.Admin,
			);

			expect(blockToggleRes.statusCode).toBe(404);
		});
	});
});
