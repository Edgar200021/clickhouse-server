import { randomUUID } from "node:crypto";
import path from "node:path";
import { config, loadEnvFile } from "node:process";
import type { FastifyInstance, InjectOptions } from "fastify";
import { dbCreate } from "../scripts/db-create.js";
import { dbMigrate } from "../scripts/db-migrate.js";
import { dbDelete } from "../scripts/dp-delete.js";
import { buildApp } from "../src/app.js";
import { setupConfig } from "../src/config.js";
import { VerificationPrefix } from "../src/const/redis.js";
import { fa } from "@faker-js/faker";
import { createTestAccount, createTransport } from "nodemailer";
import passwordManager from "../src/plugins/app/password-manager.js";
import nodemailer from "../src/plugins/external/nodemailer.js";

loadEnvFile(path.join(import.meta.dirname, "../.env.test"));

interface TestApp {
	app: FastifyInstance;
	close: () => Promise<void>;
	signUp: typeof signUp;
	signIn: typeof signIn;
	createAndVerify: typeof createAndVerify;
	accountVerification: typeof accountVerification;
	forgotPassword: typeof forgotPassword;
	resetPassword: typeof resetPassword;
}

async function signUp(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "POST",
		url: "/api/v1/auth/sign-up",
		...options,
	});
}

async function accountVerification(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "POST",
		url: "/api/v1/auth/verify-account",
		...options,
	});
}

async function createAndVerify(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	await this.signUp(options);
	const token = (await this.app.redis.keys("*"))
		.filter((key) => key.startsWith(VerificationPrefix))
		.at(-1)
		?.split(VerificationPrefix)
		.at(-1);

	return this.accountVerification({
		body: { token },
	});
}

async function signIn(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "POST",
		url: "/api/v1/auth/sign-in",
		...options,
	});
}

async function forgotPassword(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "POST",
		url: "/api/v1/auth/forgot-password",
		...options,
	});
}

async function resetPassword(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "PATCH",
		url: "/api/v1/auth/reset-password",
		...options,
	});
}

export async function buildTestApp(): Promise<TestApp> {
	const config = setupConfig();

	config.database.name = randomUUID();
	config.rateLimit.signUpLimit = 10;
	config.rateLimit.notFoundLimit = 10;
	config.rateLimit.forgotPasswordLimit = 10;
	config.rateLimit.resetPasswordLimit = 10;
	config.logger.logToFile = "false";

	await dbCreate(config.database);
	await dbMigrate(config.database);

	const fastify = await buildApp(config);

	await fastify.redis.select(15);
	await fastify.redis.flushdb();

	return {
		app: fastify,
		async close() {
			await fastify.close();
			await dbDelete(config.database);
		},
		signUp,
		accountVerification,
		createAndVerify,
		signIn,
		forgotPassword,
		resetPassword,
	};
}
