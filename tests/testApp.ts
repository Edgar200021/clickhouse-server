import path from "node:path";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { RedisContainer } from "@testcontainers/redis";
import type {
	FastifyInstance,
	InjectOptions,
	LightMyRequestResponse,
} from "fastify";
import { runMigrations } from "../scripts/db-migrate.js";
import { runSeed } from "../scripts/db-seed.js";
import { buildApp } from "../src/app.js";
import { setupConfig } from "../src/config.js";
import { MaxCartItemCount } from "../src/const/const.js";
import { VerificationPrefix } from "../src/const/redis.js";
import type { CartItem } from "../src/types/db/cart.js";
import type { Category } from "../src/types/db/category.js";
import type { UserRole } from "../src/types/db/db.js";
import type { Manufacturer } from "../src/types/db/manufacturer.js";
import type { Order } from "../src/types/db/order.js";
import type {
	Product,
	ProductSku,
	ProductSkuImages,
	ProductSkuPackage,
} from "../src/types/db/product.js";
import type { Promocode } from "../src/types/db/promocode.js";
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

export const omit = <T extends Record<string, unknown>>(
	obj: T,
	key: keyof T | (keyof T)[],
) => {
	const copied = structuredClone(obj);

	if (Array.isArray(key)) {
		for (const k of key) {
			delete copied[k];
		}
	} else {
		delete copied[key];
	}

	return copied;
};

export interface TestApp {
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
	getProductsSkus: typeof getProductsSkus;
	getProductSku: typeof getProductSku;
	getCart: typeof getCart;
	addCartPromocode: typeof addCartPromocode;
	deleteCartPromocode: typeof deleteCartPromocode;
	addCartItem: typeof addCartItem;
	updateCartItem: typeof updateCartItem;
	deleteCartItem: typeof deleteCartItem;
	createOrder: typeof createOrder;
	getOrder: typeof getOrder;
	getOrders: typeof getOrders;

	// Admin routes
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
	getProductsSkusAdmin: typeof getProductsSkusAdmin;
	getProductSkuAdmin: typeof getProductSkuAdmin;
	createProductSku: typeof createProductSku;
	updateProductSku: typeof updateProductSku;
	removeProductSkuImage: typeof removeProductSkuImage;
	removeProductSkuPackage: typeof removeProductSkuPackage;
	getPromocodes: typeof getPromocodes;
	createPromocode: typeof createPromocode;
	updatePromocode: typeof updatePromocode;
	deletePromocode: typeof deletePromocode;
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
		console.log(res);
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

async function getProductsSkus(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "GET",
		url: "/api/v1/product-sku",
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
		url: `/api/v1/product-sku/${productSkuId}`,
		...options,
	});
}

async function getCart(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "GET",
		url: `/api/v1/cart`,
		...options,
	});
}

async function addCartPromocode(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "POST",
		url: `/api/v1/cart/promocode`,
		...options,
	});
}

async function deleteCartPromocode(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "DELETE",
		url: `/api/v1/cart/promocode`,
		...options,
	});
}

async function addCartItem(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "POST",
		url: `/api/v1/cart/items`,
		...options,
	});
}

async function updateCartItem(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
	cartItemId?: CartItem["id"],
) {
	return await this.app.inject({
		method: "PATCH",
		url: `/api/v1/cart/items/${cartItemId}`,
		...options,
	});
}

async function deleteCartItem(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
	cartItemId?: CartItem["id"],
) {
	return await this.app.inject({
		method: "DELETE",
		url: `/api/v1/cart/items/${cartItemId}`,
		...options,
	});
}

async function createOrder(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "POST",
		url: `/api/v1/order`,
		...options,
	});
}

async function getOrders(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "GET",
		url: `/api/v1/order`,
		...options,
	});
}

async function getOrder(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
	orderNumber?: Order["number"],
) {
	return await this.app.inject({
		method: "GET",
		url: `/api/v1/order/${orderNumber}`,
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

async function getProductsSkusAdmin(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "GET",
		url: `/api/v1/admin/products-sku`,
		...options,
	});
}

async function getProductSkuAdmin(
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

async function getPromocodes(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "GET",
		url: `/api/v1/admin/promocode`,
		...options,
	});
}

async function createPromocode(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "POST",
		url: `/api/v1/admin/promocode`,
		...options,
	});
}

async function updatePromocode(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
	promocodeId?: Promocode["id"],
) {
	return await this.app.inject({
		method: "PATCH",
		url: `/api/v1/admin/promocode/${promocodeId}`,
		...options,
	});
}

async function deletePromocode(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
	promocodeId?: Promocode["id"],
) {
	return await this.app.inject({
		method: "DELETE",
		url: `/api/v1/admin/promocode/${promocodeId}`,
		...options,
	});
}

export async function buildTestApp(): Promise<TestApp> {
	const config = setupConfig();

	const [postgresContainer, redisContainer] = await Promise.all([
		new PostgreSqlContainer("postgres:16-alpine").start(),
		new RedisContainer("redis:7").withExposedPorts(6379).start(),
	]);

	config.database.host = postgresContainer.getHost();
	config.database.port = postgresContainer.getPort();
	config.database.name = postgresContainer.getDatabase();
	config.database.user = postgresContainer.getUsername();
	config.database.password = postgresContainer.getPassword();

	config.redis.host = redisContainer.getHost();
	config.redis.port = redisContainer.getMappedPort(6379);
	config.redis.password = redisContainer.getPassword();

	config.rateLimit.signUpLimit = MaxCartItemCount + 5;
	config.rateLimit.signInLimit = MaxCartItemCount + 5;
	config.rateLimit.notFoundLimit = 10;
	config.rateLimit.forgotPasswordLimit = 10;
	config.rateLimit.resetPasswordLimit = 10;
	config.rateLimit.accountVerificationLimit = MaxCartItemCount + 5;
	config.rateLimit.getMeLimit = 5;
	config.rateLimit.getCartLimit = 5;
	config.rateLimit.addCartItemLimit = MaxCartItemCount + 2;
	config.rateLimit.createOrderLimit = 50;

	config.logger.logToFile = false;

	await runMigrations(postgresContainer.getConnectionUri());
	await runSeed(postgresContainer.getConnectionUri());

	const fastify = await buildApp(config);

	return {
		app: fastify,
		async close() {
			await fastify.close();
			await redisContainer.stop({ remove: true, removeVolumes: true });
			await postgresContainer.stop({ removeVolumes: true, remove: true });
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
		getProductsSkus,
		getProductSku,
		getCart,
		addCartPromocode,
		deleteCartPromocode,
		addCartItem,
		updateCartItem,
		deleteCartItem,
		createOrder,
		getOrders,
		getOrder,

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
		getProductsSkusAdmin,
		getProductSkuAdmin,
		createProductSku,
		updateProductSku,
		removeProductSkuImage,
		removeProductSkuPackage,
		getPromocodes,
		createPromocode,
		updatePromocode,
		deletePromocode,
	};
}

export async function withTestApp(fn: (app: TestApp) => Promise<void>) {
	const app = await buildTestApp();

	try {
		await fn(app);
	} finally {
		await app.close();
	}
}
