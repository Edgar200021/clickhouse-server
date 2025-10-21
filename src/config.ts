import { z } from "zod";

declare module "fastify" {
	interface FastifyInstance {
		config: Config;
	}
}

export const configSchema = z.object({
	application: z.object({
		host: z.string(),
		port: z.coerce.number().min(1).max(65535),
		clientUrl: z.string(),
		clientAccountVerificationPath: z.string(),
		clientResetPasswordPath: z.string(),
		sessionCookieName: z.string(),
		oauthStateCookieName: z.string(),
		sessionTTLMinutes: z.coerce.number().min(1440).max(43800),
		oauthSessionTTLMinutes: z.coerce.number().min(30).max(60),
		oauthStateTTlMinutes: z.coerce.number().min(1).max(3),
		verificationTokenTTLMinutes: z.coerce.number().min(60).max(1440),
		resetPasswordTTLMinutes: z.coerce.number().min(5).max(15),
		cookieSecret: z.string().min(20),
		cookieSecure: z
			.enum(["true", "false"])
			.transform((value) => value === "true"),
		orderPaymentTTLMinutes: z.coerce.number().positive().min(10),
		maxPendingOrdersPerUser: z.coerce.number().min(1).max(3),
		fastifyCloseGraceDelay: z.coerce
			.number()
			.min(500)
			.max(5000)
			.default(500)
			.optional(),
	}),
	oauth: z.object({
		googleClientId: z.string(),
		googleClientSecret: z.string(),
		facebookClientId: z.string(),
		facebookClientSecret: z.string(),
	}),
	database: z.object({
		name: z.string(),
		host: z.string(),
		port: z.coerce.number().min(1).max(65535),
		user: z.string(),
		password: z.string(),
		ssl: z.enum(["true", "false"]).transform((value) => value === "true"),
		poolMin: z.coerce.number().min(1).max(5).default(2).optional(),
		poolMax: z.coerce.number().min(1).max(10).default(10).optional(),
		databaseUrl: z.string(),
	}),
	redis: z.object({
		host: z.string(),
		port: z.coerce.number(),
		password: z.string(),
		db: z.coerce.number().min(0).optional(),
	}),
	logger: z.object({
		logLevel: z.enum(["info", "warn", "error", "fatal"]).optional(),
		logToFile: z.enum(["true", "false"]).transform((value) => value === "true"),
		logInfoPath: z.string().optional(),
		logWarnPath: z.string().optional(),
		logErrorPath: z.string().optional(),
	}),
	mailer: z.object({
		host: z.string(),
		port: z.coerce.number(),
		secure: z.enum(["true", "false"]).transform((value) => value === "true"),
		user: z.string(),
		password: z.string(),
	}),
	cloudinary: z.object({
		cloudName: z.string(),
		apiKey: z.string(),
		apiSecret: z.string(),
		secure: z.enum(["true", "false"]).transform((value) => value === "true"),
		uploadFolder: z.string(),
	}),
	exchangeRate: z.object({
		baseUrl: z.string().nonempty(),
		apiKey: z.string().nonempty(),
	}),
	rateLimit: z.object({
		globalLimit: z.coerce.number().min(10).max(100).default(100).optional(),
		notFoundLimit: z.coerce.number().min(3).max(5).default(5).optional(),
		signUpLimit: z.coerce.number().min(5).max(8).default(5).optional(),
		signInLimit: z.coerce.number().min(5).max(15).default(10).optional(),
		accountVerificationLimit: z.coerce
			.number()
			.min(3)
			.max(5)
			.default(3)
			.optional(),
		forgotPasswordLimit: z.coerce.number().min(3).max(5).default(3).optional(),
		resetPasswordLimit: z.coerce.number().min(1).max(1).default(1).optional(),
		logoutLimit: z.coerce.number().min(1).max(3).default(3).optional(),
		oauthSignIn: z.coerce.number().min(1).max(3).default(3).optional(),
		getMeLimit: z.coerce.number().min(20).max(100).default(100).optional(),
		getCategoriesLimit: z.coerce
			.number()
			.min(20)
			.max(100)
			.default(100)
			.optional(),
		getProductsSkusLimit: z.coerce
			.number()
			.min(20)
			.max(100)
			.default(100)
			.optional(),
		getProductskuLimit: z.coerce
			.number()
			.min(20)
			.max(100)
			.default(100)
			.optional(),
		getCartLimit: z.coerce.number().min(20).max(100).default(100).optional(),
		addCartPromocodeLimit: z.coerce
			.number()
			.min(3)
			.max(5)
			.default(3)
			.optional(),
		deleteCartPromocodeLimit: z.coerce
			.number()
			.min(3)
			.max(5)
			.default(3)
			.optional(),
		addCartItemLimit: z.coerce
			.number()
			.min(20)
			.max(100)
			.default(100)
			.optional(),
		updateCartItemLimit: z.coerce
			.number()
			.min(20)
			.max(100)
			.default(100)
			.optional(),
		deleteCartItemLimit: z.coerce
			.number()
			.min(20)
			.max(100)
			.default(100)
			.optional(),
		clearCartLimit: z.coerce.number().min(20).max(100).default(100).optional(),
		createOrderLimit: z.coerce.number().min(3).max(5).default(3).optional(),
		getOrdersLimit: z.coerce.number().min(20).max(100).default(100).optional(),
		getOrderLimit: z.coerce.number().min(20).max(100).default(100).optional(),
	}),
});

export type Config = z.Infer<typeof configSchema>;

export function setupConfig(): Config {
	const config = configSchema.parse({
		application: {
			port: process.env.APPLICATION_PORT,
			host: process.env.APPLICATION_HOST,
			clientUrl: process.env.APPLICATION_CLIENTURL,
			clientAccountVerificationPath:
				process.env.APPLICATION_CLIENT_ACCOUNT_VERIFICATION_PATH,
			clientResetPasswordPath:
				process.env.APPLICATION_CLIENT_RESET_PASSWORD_PATH,
			cookieSecret: process.env.APPLICATION_COOKIE_SECRET,
			cookieSecure: process.env.APPLICATION_COOKIE_SECURE,
			sessionCookieName: process.env.SESSION_COOKIE_NAME,
			oauthStateCookieName: process.env.OAUTH_STATE_COOKIE_NAME,
			sessionTTLMinutes: process.env.SESSION_TTL_MINUTES,
			oauthSessionTTLMinutes: process.env.OAUTH_SESSION_TTL_MINUTES,
			oauthStateTTlMinutes: process.env.OAUTH_STATE_TTL_MINUTES,
			resetPasswordTTLMinutes: process.env.RESET_PASSWORD_TTL_MINUTES,
			verificationTokenTTLMinutes: process.env.VERIFICATION_TOKEN_TTL_MINUTES,
			orderPaymentTTLMinutes: process.env.ORDER_PAYMENT_TTL_MINUTES,
			maxPendingOrdersPerUser: process.env.MAX_PENDING_ORDERS_PER_USER,
			fastifyCloseGraceDelay: process.env.FASTIFY_CLOSE_GRACE_DELAY,
		},
		oauth: {
			googleClientId: process.env.OAUTH_GOOGLE_CLIENT_ID,
			googleClientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET,
			facebookClientId: process.env.OAUTH_FACEBOOK_CLIENT_ID,
			facebookClientSecret: process.env.OAUTH_FACEBOOK_CLIENT_SECRET,
		},
		database: {
			name: process.env.DATABASE_NAME,
			host: process.env.DATABASE_HOST,
			port: process.env.DATABASE_PORT,
			user: process.env.DATABASE_USER,
			password: process.env.DATABASE_PASSWORD,
			ssl: process.env.DATABASE_SSL,
			poolMin: process.env.DATABASE_POOL_MIN,
			poolMax: process.env.DATABASE_POOL_MAX,
			databaseUrl: process.env.DATABASE_URL,
		},
		redis: {
			host: process.env.REDIS_HOST,
			port: process.env.REDIS_PORT,
			password: process.env.REDIS_PASSWORD,
			db: process.env.REDIS_DB,
		},
		logger: {
			logToFile: process.env.LOG_TO_FILE,
			logInfoPath: process.env.LOG_INFO_PATH,
			logWarnPath: process.env.LOG_WARN_PATH,
			logErrorPath: process.env.LOG_ERROR_PATH,
		},
		mailer: {
			host: process.env.NODEMAILER_HOST,
			port: process.env.NODEMAILER_PORT,
			secure: process.env.NODEMAILER_SECURE,
			user: process.env.NODEMAILER_USER,
			password: process.env.NODEMAILER_PASSWORD,
		},
		cloudinary: {
			cloudName: process.env.CLOUDINARY_CLOUD_NAME,
			apiKey: process.env.CLOUDINARY_API_KEY,
			apiSecret: process.env.CLOUDINARY_API_SECRET,
			secure: process.env.CLOUDINARY_SECURE,
			uploadFolder: process.env.CLOUDINARY_UPLOAD_FOLDER,
		},
		exchangeRate: {
			baseUrl: process.env.EXCHANGE_RATE_BASE_URL,
			apiKey: process.env.EXCHANGE_RATE_API_KEY,
		},
		rateLimit: {
			globalLimit: process.env.RATE_LIMIT_GLOBAL,
			notFoundLimit: process.env.RATE_LIMIT_NOT_FOUND,
			signUpLimit: process.env.RATE_LIMIT_SIGN_UP,
			signInLimit: process.env.RATE_LIMIT_SIGN_IN,
			accountVerificationLimit: process.env.RATE_LIMIT_ACCOUNT_VERIFICATION,
			forgotPasswordLimit: process.env.RATE_LIMIT_FORGOT_PASSWORD,
			resetPasswordLimit: process.env.RATE_LIMIT_RESET_PASSWORD,
			logoutLimit: process.env.RATE_LIMIT_LOGOUT,
			oauthSignIn: process.env.RATE_LIMIT_OAUTH_SIGN_IN,
			getMeLimit: process.env.RATE_LIMIT_GET_ME,
			getCategoriesLimit: process.env.RATE_LIMIT_GET_CATEGORIES,
			getProductsSkusLimit: process.env.RATE_LIMIT_GET_PRODUCTS_SKUS,
			getProductskuLimit: process.env.RATE_LIMIT_GET_PRODUCT_SKU,
			getCartLimit: process.env.RATE_LIMIT_GET_CART,
			addCartPromocodeLimit: process.env.RATE_LIMIT_ADD_CART_PROMOCODE,
			deleteCartPromocodeLimit: process.env.RATE_LIMIT_DELETE_CART_PROMOCODE,
			addCartItemLimit: process.env.RATE_LIMIT_ADD_CART_ITEM,
			updateCartItemLimit: process.env.RATE_LIMIT_UPDATE_CART_ITEM,
			deleteCartItemLimit: process.env.RATE_LIMIT_DELETE_CART_ITEM,
			clearCartLimit: process.env.RATE_LIMIT_CLEAR_CART,
			createOrderLimit: process.env.RATE_LIMIT_CREATE_ORDER,
			getOrdersLimit: process.env.RATE_LIMIT_GET_ORDERS,
			getOrderLimit: process.env.RATE_LIMIT_GET_ORDER,
		},
	});

	return config;
}
