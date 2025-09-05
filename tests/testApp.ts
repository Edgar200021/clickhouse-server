import { randomUUID } from "node:crypto";
import path from "node:path";
import type {
	FastifyInstance,
	InjectOptions,
	LightMyRequestResponse,
} from "fastify";
import { dbCreate } from "../scripts/db-create.js";
import { runMigrations } from "../scripts/db-migrate.js";
import { runSeed } from "../scripts/db-seed.js";
import { dbDelete } from "../scripts/dp-delete.js";
import { buildApp } from "../src/app.js";
import { setupConfig } from "../src/config.js";
import { VerificationPrefix } from "../src/const/redis.js";
import type { Category } from "../src/types/db/category.js";
import type { UserRole } from "../src/types/db/db.js";
import type { Manufacturer } from "../src/types/db/manufacturer.js";
import type {
	Product,
	ProductSku,
	ProductSkuImages,
	ProductSkuPackage,
} from "../src/types/db/product.js";
import type { User } from "../src/types/db/user.js";

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
export const TxtPath = path.join(import.meta.dirname, "./assets/text.txt");
export const HtmlPath = path.join(import.meta.dirname, "./assets/index.html");

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
	blockToggle: typeof blockToggle;
	getProducts: typeof getProducts;
	getProduct: typeof getProduct;
	createProduct: typeof createProduct;
	updateProduct: typeof updateProduct;
	deleteProduct: typeof deleteProduct;
	getProductsSkus: typeof getProductsSkus;
	getProductSku: typeof getProductSku;
	createProductSku: typeof createProductSku;
	updateProductSku: typeof updateProductSku;
	removeProductSkuImage: typeof removeProductSkuImage;
	removeProductSkuPackage: typeof removeProductSkuPackage;
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
			.where("email", "=", signInBody.body.email.toLowerCase())
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

async function blockToggle(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
	userId?: User["id"],
) {
	return await this.app.inject({
		method: "PATCH",
		url: `/api/v1/admin/users${userId ? `/${userId}/block-toggle` : ""}`,
		...options,
	});
}

async function getProducts(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "GET",
		url: `/api/v1/admin/products`,
		...options,
	});
}

async function getProduct(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
	productId?: Product["id"],
) {
	return await this.app.inject({
		method: "GET",
		url: `/api/v1/admin/products${productId ? `/${productId}` : ""}`,
		...options,
	});
}

async function createProduct(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "POST",
		url: `/api/v1/admin/products`,
		...options,
	});
}

async function updateProduct(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
	productId?: Product["id"],
) {
	return await this.app.inject({
		method: "PATCH",
		url: `/api/v1/admin/products${productId ? `/${productId}` : ""}`,
		...options,
	});
}

async function deleteProduct(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
	productId?: Product["id"],
) {
	return await this.app.inject({
		method: "DELETE",
		url: `/api/v1/admin/products${productId ? `/${productId}` : ""}`,
		...options,
	});
}

async function getProductsSkus(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "GET",
		url: `/api/v1/admin/products-sku`,
		...options,
	});
}

async function getProductSku(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
	productSkuId?: ProductSku["id"],
) {
	return await this.app.inject({
		method: "GET",
		url: `/api/v1/admin/products-sku/${productSkuId}`,
		...options,
	});
}

async function createProductSku(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "POST",
		url: `/api/v1/admin/products-sku`,
		...options,
	});
}

async function updateProductSku(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
	productSkuId?: ProductSku["id"],
) {
	return await this.app.inject({
		method: "PATCH",
		url: `/api/v1/admin/products-sku/${productSkuId}`,
		...options,
	});
}

async function removeProductSkuImage(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
	args?: {
		productSkuId: ProductSku["id"];
		imageId: ProductSkuImages["id"];
	},
) {
	return await this.app.inject({
		method: "DELETE",
		url: `/api/v1/admin/products-sku/${args?.productSkuId}/images/${args?.imageId}`,
		...options,
	});
}

async function removeProductSkuPackage(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
	args?: {
		productSkuId: ProductSku["id"];
		packageId: ProductSkuPackage["id"];
	},
) {
	return await this.app.inject({
		method: "DELETE",
		url: `/api/v1/admin/products-sku/${args?.productSkuId}/packages/${args?.packageId}`,
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
	process.env.DATABASE_URL = `postgresql://${config.database.user}:${config.database.password}@${config.database.host}:${config.database.port}/${config.database.name}`;

	await dbCreate(config.database);
	await runMigrations();
	await runSeed();

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
		blockToggle,
		getProducts,
		getProduct,
		createProduct,
		updateProduct,
		deleteProduct,
		getProductsSkus,
		getProductSku,
		createProductSku,
		updateProductSku,
		removeProductSkuImage,
		removeProductSkuPackage,
	};
}
