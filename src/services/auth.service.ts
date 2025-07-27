import {
	FastifyBaseLogger,
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
} from "fastify";
import { SignUpRequest } from "../schemas/auth/sign-up.schema.js";
import { randomBytes, randomUUID } from "crypto";
import {
	ResetPasswordPrefix,
	SessionPrefix,
	VerificationPrefix,
} from "../const/redis.js";
import { VerifyAccountRequest } from "../schemas/auth/verify-account.schema.js";
import { assertValidUser } from "../utils/user.utils.js";
import { SignInRequest } from "../schemas/auth/sign-in.schema.js";
import { User } from "../types/db/user.js";
import { FrogotPasswordRequest } from "../schemas/auth/forgot-password.schema.js";
import { ResetPasswordRequest } from "../schemas/auth/reset-password.schema.js";
import { sql } from "kysely";
import { OAuthRequqestQuery } from "../schemas/auth/oauth.schema.js";
import { OAauthSessionPrefix } from "../const/session.js";

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
			})
			.returning("id")
			.executeTakeFirstOrThrow();

		log.info({ userID: id }, "User Created");

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

		log.info({ email }, "Verification Email Sent");
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
			})
			.where("id", "=", userID)
			.execute();

		log.info({ userID }, "User verified");
	}

	async function signIn(data: SignInRequest, log: FastifyBaseLogger) {
		const user = await kysely
			.selectFrom("users")
			.selectAll()
			.where("email", "=", data.email)
			.executeTakeFirst();

		if (
			!user ||
			!(await passwordManager.compare(data.password, user.password ?? ""))
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
		data: FrogotPasswordRequest,
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
				user!.email!,
			),
			emailManager.sendResetPasswordEmail(user!.email!, token, (err) => {
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
		const session = req.cookies[config.application.sessionName];

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

	function googleSignInUrl(req: FastifyRequest): string {
		const redirectUri = generateRedirectUri(req);
		const url = oAuth2Manager.generateGoogleRedirectUrl(redirectUri);

		return url;
	}

	async function googleSignIn(
		data: OAuthRequqestQuery,
		req: FastifyRequest,
		reply: FastifyReply,
	) {
		const { code } = data;
		const redirectUri = generateRedirectUri(req);

		const googleUser = await oAuth2Manager.getUserInfo(
			redirectUri,
			code,
			(err) => {
				req.log.error({ err }, "Failed to authorize with google:");
			},
		);

		if (!googleUser.verified_email) {
			return reply.redirect(`${config.application.clientUrl}`);
		}

		const dbUser = await kysely
			.selectFrom("users")
			.select(["googleId", "email", "isBanned", "isVerified", "id"])
			.where((eb) =>
				eb.or([
					eb("googleId", "=", googleUser.id),
					eb("email", "=", googleUser.email),
				]),
			)
			.executeTakeFirst();

		if (!dbUser) {
			const newUser = await kysely
				.insertInto("users")
				.values({
					email: googleUser.email,
					googleId: googleUser.id,
					isVerified: true,
				})
				.returning("id")
				.executeTakeFirstOrThrow();

			const uuid = await generateSession(newUser, "regular");

			return reply
				.cookie(
					config.application.sessionName,
					`${OAauthSessionPrefix}${uuid}`,
					{
						maxAge: config.application.OAuth2sessionTTLMinutes * 60,
					},
				)
				.redirect(`${config.application.clientUrl}`);
		}

		assertValidUser(dbUser, req.log, httpErrors, {
			prefix: "Failed to authorize with google:",
			checkConditions: ["banned", "notVerified"],
		});

		if (!dbUser.googleId) {
			await kysely
				.updateTable("users")
				.set({
					googleId: googleUser.id,
				})
				.execute();
		}

		const uuid = await generateSession(dbUser, "oauth");

		return reply
			.cookie(config.application.sessionName, `${OAauthSessionPrefix}${uuid}`, {
				maxAge: config.application.OAuth2sessionTTLMinutes * 60,
			})
			.redirect(`${config.application.clientUrl}`);
	}

	function generateRedirectUri(req: FastifyRequest) {
		return `${req.protocol}://${req.host}/api/v1/auth/google/callback`;
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
					: config.application.OAuth2sessionTTLMinutes),
			user.id,
		);

		return uuid;
	}

	return {
		signUp,
		verifyAccount,
		signIn,
		forgotPassword,
		resetPassword,
		logout,
		googleSignInUrl,
		googleSignIn,
	};
}
