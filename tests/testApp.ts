import { randomUUID } from "node:crypto";
import type {
	FastifyInstance,
	InjectOptions,
	LightMyRequestResponse,
} from "fastify";
import { dbCreate } from "../scripts/db-create.js";
import { dbMigrate } from "../scripts/db-migrate.js";
import { dbDelete } from "../scripts/dp-delete.js";
import { buildApp } from "../src/app.js";
import { setupConfig } from "../src/config.js";
import { VerificationPrefix } from "../src/const/redis.js";

interface TestApp {
	app: FastifyInstance;
	close: () => Promise<void>;
	signUp: typeof signUp;
	signIn: typeof signIn;
	withSignIn: typeof withSignIn;
	createAndVerify: typeof createAndVerify;
	accountVerification: typeof accountVerification;
	forgotPassword: typeof forgotPassword;
	resetPassword: typeof resetPassword;
	logout: typeof logout;
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

async function withSignIn(
	this: TestApp,
	signInBody: Pick<InjectOptions, "body">,
	arg:
		| InjectOptions
		| {
				fn: (
					this: TestApp,
					options?: Omit<InjectOptions, "method" | "url">,
				) => Promise<LightMyRequestResponse>;
				args?: Omit<InjectOptions, "method" | "url">;
		  },
): Promise<LightMyRequestResponse> {
	const res = await this.createAndVerify(signInBody);
	if (res.statusCode !== 200) {
		this.app.log.info(res);
		throw new Error("Failed to create and verify account");
	}

	const signInRes = await this.signIn({ ...signInBody });
	if (signInRes.statusCode !== 200) {
		throw new Error("Failed to sign in");
	}

	const cookie = signInRes.cookies.find(
		(cookie) => cookie.name === this.app.config.application.sessionName,
	);

	if (!cookie) {
		throw new Error("Cookie not found");
	}

	if ("fn" in arg) {
		return arg.fn.call(this, {
			...arg.args,
			cookies: {
				...(arg ? arg.args?.cookies : {}),
				[cookie.name]: cookie.value,
			},
		});
	}

	return this.app.inject({
		...arg,
		cookies: {
			...arg.cookies,
			[cookie.name]: cookie.value,
		},
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

async function logout(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "POST",
		url: "/api/v1/auth/logout",
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
	config.rateLimit.accountVerificationLimit = 10;
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
		withSignIn,
		forgotPassword,
		resetPassword,
		logout,
	};
}
