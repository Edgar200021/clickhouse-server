import { randomBytes, randomUUID } from "node:crypto";
import type {
	FastifyBaseLogger,
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
} from "fastify";
import { type ReferenceExpression, sql } from "kysely";
import {
	OAauthSessionPrefix,
	OAuthRedirectPathSeperator,
} from "../const/cookie.js";
import {
	ResetPasswordPrefix,
	SessionPrefix,
	VerificationPrefix,
} from "../const/redis.js";
import type { ForgotPasswordRequest } from "../schemas/auth/forgot-password.schema.js";
import type {
	GenOAuthRedirectUrlQuery,
	OAuthRequqestQuery,
} from "../schemas/auth/oauth.schema.js";
import type { ResetPasswordRequest } from "../schemas/auth/reset-password.schema.js";
import type { SignInRequest } from "../schemas/auth/sign-in.schema.js";
import type { SignUpRequest } from "../schemas/auth/sign-up.schema.js";
import type { VerifyAccountRequest } from "../schemas/auth/verify-account.schema.js";
import type { DB } from "../types/db/db.js";
import type { User } from "../types/db/user.js";
import type { OAuth2Provider } from "../types/oauth2.js";
import { assertValidUser } from "../utils/user.utils.js";

export function createAuthService(instance: FastifyInstance) {
	const {
		kysely,
		oAuth2Manager,
		httpErrors,
		passwordManager,
		emailManager,
		redis,
		config,
	} = instance;

	async function signUp(data: SignUpRequest, log: FastifyBaseLogger) {
		const { email, password } = data;

		const user = await kysely
			.selectFrom("users")
			.select("id")
			.where("email", "=", email)
			.executeTakeFirst();

		if (user) {
			log.info(`Sign Up Failed: User with email ${email} already exists`);
			throw httpErrors.badRequest(`User with email ${email} already exists`);
		}

		const hashed = await passwordManager.hash(password);
		const { id } = await kysely
			.insertInto("users")
			.values({
				email,
				password: hashed,
				createdAt: sql`NOW()`,
			})
			.returning("id")
			.executeTakeFirstOrThrow();

		const token = randomBytes(16).toString("hex");

		await Promise.all([
			emailManager.sendVerificationEmail(email, token, (err) => {
				log.error({ err, email }, "Failed to send verification email");
			}),
			redis.setex(
				`${VerificationPrefix}${token}`,
				60 * config.application.verificationTokenTTLMinutes,
				id,
			),
		]);
	}

	async function verifyAccount(
		data: VerifyAccountRequest,
		log: FastifyBaseLogger,
	) {
		const { token } = data;

		const userID = await redis.getdel(`${VerificationPrefix}${token}`);

		if (!userID) {
			log.info({ token }, "Verification failed: invalid or expired token");
			throw httpErrors.notFound("Invalid or expired token");
		}

		const user = await kysely
			.selectFrom("users")
			.selectAll()
			.where("id", "=", userID)
			.executeTakeFirst();

		assertValidUser(user, log, httpErrors, {
			prefix: "Verification failed:",
			checkConditions: ["undefined", "banned"],
		});

		if (user?.isVerified) {
			log.info(
				{ userID: user?.id },
				`Verification failed:User is already verified`,
			);
			throw httpErrors.badRequest("User is already verified");
		}

		await kysely
			.updateTable("users")
			.set({
				isVerified: true,
				updatedAt: sql`NOW()`,
			})
			.where("id", "=", userID)
			.execute();
	}

	async function signIn(data: SignInRequest, log: FastifyBaseLogger) {
		const user = await kysely
			.selectFrom("users")
			.selectAll()
			.where("email", "=", data.email)
			.executeTakeFirst();

		if (
			!user ||
			!user.password ||
			!(await passwordManager.compare(data.password, user.password))
		) {
			log.info("Invalid credentials");
			throw httpErrors.badRequest("Invalid credentials");
		}

		assertValidUser(user, log, httpErrors, {
			prefix: "Sign in failed:",
			checkConditions: ["undefined", "banned", "notVerified"],
		});

		const uuid = await generateSession(user, "regular");

		return { uuid, user };
	}

	async function forgotPassword(
		data: ForgotPasswordRequest,
		log: FastifyBaseLogger,
	) {
		const user = await kysely
			.selectFrom("users")
			.select(["id", "email", "isVerified", "isBanned"])
			.where("email", "=", data.email)
			.executeTakeFirst();

		assertValidUser(user, log, httpErrors, {
			prefix: "Forgot password failed:",
			checkConditions: ["undefined", "notVerified", "banned"],
		});

		const token = randomBytes(16).toString("hex");

		await Promise.all([
			redis.setex(
				`${ResetPasswordPrefix}${token}`,
				60 * config.application.resetPasswordTTLMinutes,
				user!.email,
			),
			emailManager.sendResetPasswordEmail(user!.email, token, (err) => {
				log.error({ err }, "Failed to send reset password email");
			}),
		]);
	}

	async function resetPassword(
		data: ResetPasswordRequest,
		log: FastifyBaseLogger,
	) {
		const email = await redis.getdel(`${ResetPasswordPrefix}${data.token}`);

		if (!email) {
			log.info("Token not found");
			throw httpErrors.notFound("Token not found");
		}

		const user = await kysely
			.selectFrom("users")
			.select(["id", "isBanned", "isVerified"])
			.where("email", "=", email)
			.executeTakeFirst();

		assertValidUser(user, log, httpErrors, {
			prefix: "Reset password failed:",
			checkConditions: ["undefined", "banned", "notVerified"],
		});

		const hashedPassword = await passwordManager.hash(data.newPassword);

		await kysely
			.updateTable("users")
			.set("password", hashedPassword)
			.set("updatedAt", sql`NOW()`)
			.where("email", "=", email)
			.execute();
	}

	async function logout(req: FastifyRequest) {
		const session = req.cookies[config.application.sessionCookieName];

		if (!session) {
			req.log.info("Logout failed: session not found");
			throw httpErrors.notFound("Session not found ");
		}

		const unsigned = req.unsignCookie(session);
		if (!unsigned.valid) {
			req.log.info("Logout failed: session not valid");
			throw httpErrors.badRequest("Session not valid");
		}

		const [_, value] = unsigned.value.split(OAauthSessionPrefix);

		await redis.del(`${SessionPrefix}${value ?? unsigned.value}`);
	}

	function oauth2SignInUrl(
		req: FastifyRequest,
		query: GenOAuthRedirectUrlQuery,
		provider: OAuth2Provider,
	) {
		const redirectUri = generateRedirectUri(req, provider);
		const safeFrom = query.from ? encodeURIComponent(query.from) : "";

		const uuid = randomUUID();

		const url = oAuth2Manager.generateRedirectUrl(
			redirectUri,
			provider,
			query.from ? `${uuid}${OAuthRedirectPathSeperator}${safeFrom}` : uuid,
		);

		return { url, cookieState: uuid };
	}

	async function oauthSignIn(
		data: OAuthRequqestQuery,
		req: FastifyRequest,
		reply: FastifyReply,
		provider: OAuth2Provider,
	) {
		const { code, state } = data;
		const [uuidPart, fromPart] = state.split(OAuthRedirectPathSeperator);
		const fromDecoded = fromPart ? decodeURIComponent(fromPart) : "";

		const cookieState = req.cookies[config.application.oauthStateCookieName];
		if (!cookieState) {
			req.log.info("OAuth failed: state not found in cookie");
			return reply.badRequest("Invalid state");
		}

		const unsigned = req.unsignCookie(cookieState);
		if (!unsigned.valid || unsigned.value !== uuidPart) {
			req.log.info("OAuth failed: invalid state");
			return reply.badRequest("Invalid state");
		}

		const redirectUri = generateRedirectUri(req, provider);

		const oauthUser = await oAuth2Manager.getUserInfo(
			redirectUri,
			code,
			provider,
			(err) => {
				req.log.error({ err }, "OAuth failed:");
			},
		);

		if ("verified_email" in oauthUser && !oauthUser.verified_email) {
			return reply.redirect(`${config.application.clientUrl}`);
		}

		const oauthColumn = oauthProviderToColumn(provider);
		const redirectUrl = `${config.application.clientUrl}${fromDecoded?.startsWith("/") ? fromDecoded : "/"}`;

		const dbUser = await kysely
			.selectFrom("users")
			.select([
				"googleId",
				"facebookId",
				"email",
				"isBanned",
				"isVerified",
				"id",
			])
			.where((eb) =>
				eb.or([
					eb(oauthColumn, "=", oauthUser.id),
					eb("email", "=", oauthUser.email),
				]),
			)
			.executeTakeFirst();

		if (!dbUser) {
			const newUser = await kysely
				.insertInto("users")
				.values({
					email: oauthUser.email,
					[oauthColumn]: oauthUser.id,
					isVerified: true,
					createdAt: sql`NOW()`,
				})
				.returning("id")
				.executeTakeFirstOrThrow();

			const uuid = await generateSession(newUser, "oauth");

			return reply
				.cookie(
					config.application.sessionCookieName,
					`${OAauthSessionPrefix}${uuid}`,
					{
						maxAge: config.application.oauthSessionTTLMinutes * 60,
					},
				)
				.clearCookie(config.application.oauthStateCookieName)
				.redirect(redirectUrl);
		}

		assertValidUser(dbUser, req.log, httpErrors, {
			prefix: "Failed to authorize with oauth:",
			checkConditions: ["banned", "notVerified"],
		});

		if (!dbUser[oauthColumn]) {
			await kysely
				.updateTable("users")
				.set({
					[oauthColumn]: oauthUser.id,
					isVerified: true,
					updatedAt: sql`NOW()`,
				})
				.execute();
		}

		const uuid = await generateSession(dbUser, "oauth");

		return reply
			.cookie(
				config.application.sessionCookieName,
				`${OAauthSessionPrefix}${uuid}`,
				{
					maxAge: config.application.oauthSessionTTLMinutes * 60,
				},
			)
			.clearCookie(config.application.oauthStateCookieName)
			.redirect(redirectUrl);
	}

	async function generateSession(
		user: Pick<User, "id">,
		type: "oauth" | "regular",
	) {
		const uuid = randomUUID();

		await redis.setex(
			`${SessionPrefix}${uuid}`,
			60 *
				(type === "regular"
					? config.application.sessionTTLMinutes
					: config.application.oauthSessionTTLMinutes),
			user.id,
		);

		return uuid;
	}

	function generateRedirectUri(req: FastifyRequest, type: OAuth2Provider) {
		return `${req.protocol}://${req.host}/api/v1/auth/${type}/callback`;
	}

	function oauthProviderToColumn(
		provider: OAuth2Provider,
	): Extract<ReferenceExpression<DB, "users">, "googleId" | "facebookId"> {
		if (provider === "google") return "googleId";
		if (provider === "facebook") return "facebookId";

		const x: never = provider;
		return x;
	}

	return {
		signUp,
		verifyAccount,
		signIn,
		forgotPassword,
		resetPassword,
		logout,
		oauth2SignInUrl,
		oauthSignIn,
	};
}
