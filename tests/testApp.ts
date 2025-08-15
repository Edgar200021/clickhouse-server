import { randomUUID } from "node:crypto";
import path from "node:path";
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
import type { Category } from "../src/types/db/category.js";
import type { UserRole } from "../src/types/db/db.js";
import type { Manufacturer } from "../src/types/db/manufacturer.js";

export type WithSignIn<T extends unknown[] = unknown[]> = {
	fn: (
		this: TestApp,
		options?: Omit<InjectOptions, "method" | "url">,
		...args: T
	) => Promise<LightMyRequestResponse>;
	args?: Omit<InjectOptions, "method" | "url">;
	additionalArg?: T;
};

export const ImagePath = path.join(import.meta.dirname, "./assets/photo.jpg");
export const PdfPath = path.join(import.meta.dirname, "./assets/food.pdf");

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
	getMe: typeof getMe;
	getCategories: typeof getCategories;
	createCategory: typeof createCategory;
	updateCategory: typeof updateCategory;
	deleteCategory: typeof deleteCategory;
	getManufacturers: typeof getManufacturers;
	getManufacturer: typeof getManufacturer;
	createManufacturer: typeof createManufacturer;
	updateManufacturer: typeof updateManufacturer;
	deleteManufacturer: typeof deleteManufacturer;
	getUsers: typeof getUsers;
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

async function withSignIn<
	T extends unknown[],
	U extends InjectOptions | InjectOptions[] | WithSignIn<T> | WithSignIn<T>[],
>(
	this: TestApp,
	signInBody: Pick<InjectOptions, "body">,
	arg: U,
	role?: UserRole,
): Promise<
	T extends Array<InjectOptions | WithSignIn<T>>
		? LightMyRequestResponse[]
		: LightMyRequestResponse
> {
	const res = await this.createAndVerify(signInBody);
	if (res.statusCode !== 200) {
		throw new Error("Failed to create and verify account");
	}

	if (
		role &&
		signInBody.body &&
		typeof signInBody.body === "object" &&
		"email" in signInBody.body &&
		typeof signInBody.body.email === "string"
	) {
		await this.app.kysely
			.updateTable("users")
			.set({ role })
			.where("email", "=", signInBody.body.email)
			.execute();
	}

	const signInRes = await this.signIn({ ...signInBody });
	if (signInRes.statusCode !== 200) {
		throw new Error("Failed to sign in");
	}

	const cookie = signInRes.cookies.find(
		(cookie) => cookie.name === this.app.config.application.sessionCookieName,
	);

	if (!cookie) {
		throw new Error("Cookie not found");
	}

	const run = (item: InjectOptions | WithSignIn) =>
		"fn" in item
			? item.fn.call(
					this,
					{
						...item.args,
						cookies: {
							...(item.args?.cookies || {}),
							[cookie.name]: cookie.value,
						},
					},
					...(Array.isArray(item.additionalArg)
						? item.additionalArg
						: [item.additionalArg]),
				)
			: this.app.inject({
					...item,
					cookies: { ...(item.cookies || {}), [cookie.name]: cookie.value },
				});

	if (Array.isArray(arg)) {
		return Promise.all(arg.map(run));
	}
	return run(arg);
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

async function getMe(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "GET",
		url: "/api/v1/user",
		...options,
	});
}

async function getCategories(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "GET",
		url: "/api/v1/categories",
		...options,
	});
}

async function createCategory(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "POST",
		url: "/api/v1/admin/categories",
		...options,
	});
}

async function updateCategory(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
	categoryId?: Category["id"],
) {
	return await this.app.inject({
		method: "PATCH",
		url: `/api/v1/admin/categories${categoryId ? `/${categoryId}` : ""}`,
		...options,
	});
}

async function deleteCategory(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
	categoryId?: Category["id"],
) {
	return await this.app.inject({
		method: "DELETE",
		url: `/api/v1/admin/categories${categoryId ? `/${categoryId}` : ""}`,
		...options,
	});
}

async function getManufacturers(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "GET",
		url: "/api/v1/admin/manufacturers",
		...options,
	});
}

async function getManufacturer(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
	manufacturerId?: Manufacturer["id"],
) {
	return await this.app.inject({
		method: "GET",
		url: `/api/v1/admin/manufacturers${manufacturerId ? `/${manufacturerId}` : ""}`,
		...options,
	});
}

async function createManufacturer(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "POST",
		url: "/api/v1/admin/manufacturers",
		...options,
	});
}

async function updateManufacturer(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
	manufacturerId?: Manufacturer["id"],
) {
	return await this.app.inject({
		method: "PATCH",
		url: `/api/v1/admin/manufacturers${manufacturerId ? `/${manufacturerId}` : ""}`,
		...options,
	});
}

async function deleteManufacturer(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
	manufacturerId?: Manufacturer["id"],
) {
	return await this.app.inject({
		method: "DELETE",
		url: `/api/v1/admin/manufacturers${manufacturerId ? `/${manufacturerId}` : ""}`,
		...options,
	});
}

async function getUsers(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "GET",
		url: `/api/v1/admin/users`,
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
	config.rateLimit.getMeLimit = 5;
	config.logger.logToFile = false;

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
		getMe,
		getCategories,
		createCategory,
		updateCategory,
		deleteCategory,
		getManufacturers,
		getManufacturer,
		createManufacturer,
		updateManufacturer,
		deleteManufacturer,
		getUsers,
	};
}
