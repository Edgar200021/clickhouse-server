import { randomBytes, randomUUID } from "node:crypto";
import {
	SignUpSchemaRequest,
	SignUpSchemaResponse,
} from "../schemas/auth/sign-up.schema.js";
import {
	VerifyAccountSchemaRequest,
	VerifyAccountSchemaResponse,
} from "../schemas/auth/verify-account.schema.js";
import {
	ErrorResponseSchema,
	SuccessResponseSchema,
	ValidationErrorResponseSchema,
} from "../schemas/base.schema.js";
import { assertValidUser } from "../utils/user.utils.js";
import {
	SignInSchemaRequest,
	SignInSchemaResponse,
} from "../schemas/auth/sign-in.schema.js";
import {
	ForgotPasswordSchemaResponse as ForgotPasswordSchemaResponse,
	ForgotPasswordSchemaRequest,
} from "../schemas/auth/forgot-password.schema.js";
import {
	ResetPasswordPrefix,
	SessionPrefix,
	VerificationPrefix,
} from "../const/redis.js";
import {
	ResetPasswordSchemaRequest,
	ResetPasswordSchemaResponse,
} from "../schemas/auth/reset-password.schema.js";
import { sql } from "kysely";
import {
	FastifyPluginAsyncTypebox,
	Type,
} from "@fastify/type-provider-typebox";

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
	const { kysely, httpErrors, emailManager, passwordManager, redis, config } =
		fastify;

	fastify.post(
		"/auth/sign-up",
		{
			config: {
				rateLimit: {
					max: config.rateLimit.signUpLimit,
					timeWindow: "1 minute",
				},
			},
			schema: {
				tags: ["Authentication"],
				body: SignUpSchemaRequest,
				response: {
					201: SuccessResponseSchema(SignUpSchemaResponse),
					400: Type.Union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
			},
		},
		async (req, reply) => {
			const { email, password } = req.body;

			const user = await kysely
				.selectFrom("users")
				.select("id")
				.where("email", "=", email)
				.executeTakeFirst();

			if (user) {
				req.log.info(`Sign Up Failed: User with email ${email} already exists`);
				return reply.badRequest(`User with email ${email} already exists`);
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

			req.log.info({ userID: id }, "User Created");

			const token = randomBytes(16).toString("hex");

			await Promise.all([
				emailManager.sendVerificationEmail(email, token, (err) => {
					req.log.error({ err, email }, "Failed to send verification email");
				}),
				redis.setex(
					`${VerificationPrefix}${token}`,
					60 * config.application.verificationTokenTTLMinutes,
					id,
				),
			]);

			req.log.info({ email }, "Verification Email Sent");

			reply
				.status(201)
				.send({ status: "success", data: "Registration successful" });
		},
	);

	fastify.post(
		"/auth/verify-account",
		{
			config: {
				rateLimit: {
					max: config.rateLimit.accountVerificationLimit,
					timeWindow: "1 minute",
				},
			},
			schema: {
				tags: ["Authentication"],
				body: VerifyAccountSchemaRequest,
				response: {
					200: SuccessResponseSchema(VerifyAccountSchemaResponse),
					400: Type.Union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
			},
		},
		async (req, reply) => {
			const { token } = req.body;

			const userID = await redis.getdel(`${VerificationPrefix}${token}`);

			if (!userID) {
				req.log.info(
					{ token },
					"Verification failed: invalid or expired token",
				);
				return reply.notFound("Invalid or expired token");
			}

			const user = await kysely
				.selectFrom("users")
				.selectAll()
				.where("id", "=", userID)
				.executeTakeFirst();

			assertValidUser(user, req.log, httpErrors, {
				prefix: "Verification failed:",
				checkConditions: ["undefined", "banned"],
			});

			if (user?.isVerified) {
				req.log.info(
					{ userID: user?.id },
					`Verification failed:User is not verified`,
				);
				return reply.badRequest("User is already verified");
			}

			await kysely
				.updateTable("users")
				.set({
					isVerified: true,
				})
				.where("id", "=", userID)
				.execute();

			req.log.info({ userID }, "User verified");

			reply.status(200).send({
				status: "success" as const,
				data: "Account verification successful",
			});
		},
	);

	fastify.post(
		"/auth/sign-in",
		{
			config: {
				rateLimit: {
					max: config.rateLimit.signInLimit,
					timeWindow: "1 minute",
				},
			},
			schema: {
				body: SignInSchemaRequest,
				response: {
					200: SuccessResponseSchema(SignInSchemaResponse),
					400: Type.Union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Authentication"],
			},
		},
		async (req, reply) => {
			const user = await kysely
				.selectFrom("users")
				.selectAll()
				.where("email", "=", req.body.email)
				.executeTakeFirst();

			if (
				!user ||
				!(await passwordManager.compare(req.body.password, user.password))
			) {
				req.log.info("Invalid credentials");
				throw httpErrors.badRequest("Invalid credentials");
			}

			assertValidUser(user, req.log, httpErrors, {
				prefix: "Sign in failed:",
				checkConditions: ["undefined", "banned", "notVerified"],
			});

			const uuid = randomUUID();

			await redis.setex(
				`${SessionPrefix}${uuid}`,
				60 * config.application.sessionTTLMinutes,
				user.id,
			);

			reply
				.status(200)
				.cookie(config.application.sessionName, uuid, {
					maxAge: config.application.sessionTTLMinutes * 60,
				})
				.send({
					status: "success",
					data: {
						id: user.id,
						createdAt: user.createdAt.toISOString(),
						updatedAt: user.updatedAt.toISOString(),
						firstName: user.firstName,
						lastName: user.lastName,
						isVerified: user.isVerified,
						role: user.role,
					},
				});
		},
	);

	fastify.post(
		"/auth/forgot-password",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: config.rateLimit.forgotPasswordLimit,
				},
			},
			schema: {
				body: ForgotPasswordSchemaRequest,
				response: {
					200: SuccessResponseSchema(ForgotPasswordSchemaResponse),
					400: Type.Union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Authentication"],
			},
		},
		async (req, reply) => {
			const user = await kysely
				.selectFrom("users")
				.select(["id", "email", "isVerified", "isBanned"])
				.where("email", "=", req.body.email)
				.executeTakeFirst();

			assertValidUser(user, req.log, httpErrors, {
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
					req.log.error({ err }, "Failed to send reset password email");
				}),
			]);

			reply.status(200).send({
				status: "success",
				data: "Forgot password successful",
			});
		},
	);

	fastify.patch(
		"/auth/reset-password",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: config.rateLimit.resetPasswordLimit,
				},
			},
			schema: {
				body: ResetPasswordSchemaRequest,
				response: {
					200: SuccessResponseSchema(ResetPasswordSchemaResponse),
					400: Type.Union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Authentication"],
			},
		},
		async (req, reply) => {
			const email = await redis.getdel(
				`${ResetPasswordPrefix}${req.body.token}`,
			);

			if (!email) {
				req.log.info("Token not found");
				return reply.notFound("Token not found");
			}

			const user = await kysely
				.selectFrom("users")
				.select(["id", "isBanned", "isVerified"])
				.where("email", "=", email)
				.executeTakeFirst();

			assertValidUser(user, req.log, httpErrors, {
				prefix: "Reset password failed:",
				checkConditions: ["undefined", "banned", "notVerified"],
			});

			const hashedPassword = await passwordManager.hash(req.body.newPassword);

			await kysely
				.updateTable("users")
				.set("password", hashedPassword)
				.set("updatedAt", sql`NOW()`)
				.where("email", "=", email)
				.execute();

			reply.status(200).send({
				status: "success",
				data: "Reset password successful",
			});
		},
	);
};

export default plugin;
