import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import {
	SignUpPasswordMaxLength,
	SignUpPasswordMinLength,
} from "../../../src/const/type-box.js";
import { buildTestApp } from "../../testApp.js";

describe("Authentication", () => {
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

	describe("Sign in", () => {
		it("Should return 201 status code when request is successful", async () => {
			await testApp.createAndVerify({ body: user });
			const signInRes = await testApp.signIn({ body: user });

			console.log(signInRes);

			expect(signInRes.statusCode).toBe(200);
		});
	});
});
