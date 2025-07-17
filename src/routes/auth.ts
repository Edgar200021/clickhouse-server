import { randomBytes } from "node:crypto";
import {
	type FastifyPluginAsyncTypebox,
	Type,
} from "@fastify/type-provider-typebox";
import {
	SignUpSchemaRequest,
	SignUpSchemaResponse,
} from "../schemas/auth/sign-in.schema.js";
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
				req.log.warn(
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

			assertValidUser(user, req.log, fastify.httpErrors);

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

	// fastify.post(
	// 	"/auth/sign-in",
	// 	{
	// 		schema: {
	// 			body: Type.Object({
	// 				email: Type.String({ format: "email" }),
	// 				password: Type.String({ minLength: 8, maxLength: 30 }),
	// 			}),
	// 			response: {
	// 				200: Type.Object({
	// 					message: Type.String(),
	// 				}),
	// 			},
	// 			tags: ["auth"],
	// 		},
	// 	},
	// 	(req: FastifyRequest, reply: FastifyReply) => {
	// 		reply.status(200);
	// 		return { message: "sign-in" };
	// 	},
	// );
};

export default plugin;
