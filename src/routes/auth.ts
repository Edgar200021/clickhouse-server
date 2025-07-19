import { randomBytes, randomUUID } from "node:crypto";
import {
	type FastifyPluginAsyncTypebox,
	Type,
} from "@fastify/type-provider-typebox";
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

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
	fastify.post(
		"/auth/sign-up",
		{
			config: {
				rateLimit: {
					max: fastify.config.rateLimit.signUpLimit,
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

			const user = await fastify.kysely
				.selectFrom("users")
				.select("id")
				.where("email", "=", email)
				.executeTakeFirst();

			if (user) {
				req.log.info(`Sign Up Failed: User with email ${email} already exists`);
				throw fastify.httpErrors.badRequest(
					`User with email ${email} already exists`,
				);
			}

			const hashed = await fastify.passwordManager.hash(password);
			const { id } = await fastify.kysely
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
				fastify.emailManager.sendVerificationEmail(email, token, (err) => {
					req.log.error({ err, email }, "Failed to send verification email");
				}),
				fastify.redis.setex(
					token,
					60 * fastify.config.application.verificationTokenTTLMinutes,
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
					max: fastify.config.rateLimit.accountVerificationLimit,
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

			const userID = await fastify.redis.getdel(token);

			if (!userID) {
				req.log.info(
					{ token },
					"Verification failed: invalid or expired token",
				);
				throw fastify.httpErrors.notFound("Invalid or expired token");
			}

			const user = await fastify.kysely
				.selectFrom("users")
				.selectAll()
				.where("id", "=", userID)
				.executeTakeFirst();

			assertValidUser(user, req.log, fastify.httpErrors, {
				prefix: "Sign in failed:",
				checkConditions: ["undefined", "banned"],
			});

			if (user?.isVerified) {
				req.log.info(
					{ userID: user?.id },
					`Verification failed:User is not verified`,
				);
				throw fastify.httpErrors.badRequest("User is already verified");
			}

			await fastify.kysely
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
			schema: {
				body: SignInSchemaRequest,
				response: {
					200: SignInSchemaResponse,
				},
				tags: ["auth"],
			},
		},
		async (req, reply) => {
			const user = await fastify.kysely
				.selectFrom("users")
				.selectAll()
				.where("email", "=", req.body.email)
				.executeTakeFirst();

			if (
				!user ||
				!(await fastify.passwordManager.compare(
					req.body.password,
					user.password,
				))
			) {
				req.log.info("Invalid credentials");
				throw fastify.httpErrors.badRequest("Invalid credentials");
			}

			assertValidUser(user, req.log, fastify.httpErrors, {
				prefix: "Sign in failed:",
				checkConditions: ["undefined", "banned", "notVerified"],
			});

			const uuid = randomUUID();

			await fastify.redis.setex(
				uuid,
				60 * fastify.config.application.sessionTTLMinutes,
				user.id,
			);

			reply
				.status(200)
				.cookie(fastify.config.application.sessionName, uuid, {
					maxAge: fastify.config.application.sessionTTLMinutes * 60,
				})
				.send({
					id: user.id,
					createdAt: user.createdAt.toISOString(),
					updatedAt: user.updatedAt.toISOString(),
					firstName: user.firstName,
					lastName: user.lastName,
					isVerified: user.isVerified,
					role: user.role,
				});
		},
	);
};

export default plugin;
