import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

declare module "fastify" {
	interface FastifyInstance {
		config: Config;
	}
}

export type Config = Static<typeof schema>;

const schema = Type.Object({
	application: Type.Object({
		host: Type.String(),
		port: Type.Number({ minimum: 1, maximum: 65535 }),
		clientUrl: Type.String(),
		clientAccountVerificationPath: Type.String(),
		clientResetPasswordPath: Type.String(),
		sessionCookieName: Type.String(),
		oauthStateCookieName: Type.String(),
		sessionTTLMinutes: Type.Number({ minimum: 1440, maximum: 43800 }),
		oauthSessionTTLMinutes: Type.Number({ minimum: 30, maximum: 60 }),
		oauthStateTTlMinutes: Type.Number({ minimum: 1, maximum: 3 }),
		verificationTokenTTLMinutes: Type.Number({
			minimum: 60,
			maximum: 1440,
		}),
		resetPasswordTTLMinutes: Type.Number({
			minimum: 5,
			maximum: 15,
		}),
		cookieSecret: Type.String({ minLength: 20 }),
		cookieSecure: Type.Union([Type.Literal("false"), Type.Literal("true")]),
		fastifyCloseGraceDelay: Type.Optional(
			Type.Number({ minimum: 500, maximum: 5000, default: 500 }),
		),
	}),
	oauth: Type.Object({
		googleClientId: Type.String(),
		googleClientSecret: Type.String(),
		facebookClientId: Type.String(),
		facebookClientSecret: Type.String(),
	}),
	database: Type.Object({
		name: Type.String(),
		host: Type.String(),
		port: Type.Number({ minimum: 1, maximum: 65535 }),
		user: Type.String(),
		password: Type.String(),
		ssl: Type.Boolean(),
		poolMin: Type.Optional(Type.Number({ maximum: 5, minimum: 1, default: 2 })),
		poolMax: Type.Optional(
			Type.Number({ maximum: 10, minimum: 1, default: 10 }),
		),
	}),
	redis: Type.Object({
		host: Type.String(),
		port: Type.Number(),
		password: Type.String(),
		db: Type.Optional(Type.Number({ minimum: 0 })),
	}),
	logger: Type.Object({
		logLevel: Type.Optional(
			Type.Union([
				Type.Literal("info"),
				Type.Literal("warn"),
				Type.Literal("error"),
				Type.Literal("fatal"),
			]),
		),
		logToFile: Type.Union([Type.Literal("true"), Type.Literal("false")]),
		logInfoPath: Type.Optional(Type.String()),
		logWarnPath: Type.Optional(Type.String()),
		logErrorPath: Type.Optional(Type.String()),
	}),
	mailer: Type.Object({
		host: Type.String(),
		port: Type.Number(),
		secure: Type.Boolean(),
		user: Type.String(),
		password: Type.String(),
	}),
	rateLimit: Type.Object({
		globalLimit: Type.Optional(
			Type.Number({ minimum: 10, maximum: 100, default: 100 }),
		),
		notFoundLimit: Type.Optional(
			Type.Number({ minimum: 3, maximum: 5, default: 5 }),
		),
		signUpLimit: Type.Optional(
			Type.Number({ minimum: 5, maximum: 8, default: 5 }),
		),
		signInLimit: Type.Optional(
			Type.Number({ minimum: 5, maximum: 15, default: 10 }),
		),
		accountVerificationLimit: Type.Optional(
			Type.Number({ minimum: 3, maximum: 5, default: 3 }),
		),
		forgotPasswordLimit: Type.Optional(
			Type.Number({ minimum: 3, maximum: 5, default: 3 }),
		),
		resetPasswordLimit: Type.Optional(
			Type.Number({ minimum: 1, maximum: 1, default: 1 }),
		),
		logoutLimit: Type.Optional(
			Type.Number({ minimum: 1, maximum: 3, default: 3 }),
		),
		oauthSignIn: Type.Optional(
			Type.Number({ minimum: 1, maximum: 3, default: 3 }),
		),
	}),
});

export function setupConfig(): Config {
	const config = Value.Parse(schema, {
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
		},
	});

	return config;
}
