import { randomBytes, randomUUID } from "node:crypto";
import {
	type FastifyPluginAsyncTypebox,
	Type,
} from "@fastify/type-provider-typebox";
import { sql } from "kysely";
import {
	ResetPasswordPrefix,
	SessionPrefix,
	VerificationPrefix,
} from "../const/redis.js";
import {
	ForgotPasswordRequestSchema,
	ForgotPasswordResponseSchema,
} from "../schemas/auth/forgot-password.schema.js";
import {
	ResetPasswordRequestSchema,
	ResetPasswordResponseSchema,
} from "../schemas/auth/reset-password.schema.js";
import {
	SignInRequestSchema,
	SignInResponseSchema,
} from "../schemas/auth/sign-in.schema.js";
import {
	SignUpRequestSchema,
	SignUpResponseSchema,
} from "../schemas/auth/sign-up.schema.js";
import {
	VerifyAccountRequestSchema,
	VerifyAccountResponseSchema,
} from "../schemas/auth/verify-account.schema.js";
import {
	ErrorResponseSchema,
	SuccessResponseSchema,
	ValidationErrorResponseSchema,
} from "../schemas/base.schema.js";
import { OAuthRequestQuerySchema } from "../schemas/auth/oauth.schema.js";

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
	const { config, authService } = fastify;

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
				body: SignUpRequestSchema,
				response: {
					201: SuccessResponseSchema(SignUpResponseSchema),
					400: Type.Union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
			},
		},
		async (req, reply) => {
			await authService.signUp(req.body, req.log);

			await reply
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
				body: VerifyAccountRequestSchema,
				response: {
					200: SuccessResponseSchema(VerifyAccountResponseSchema),
					400: Type.Union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
			},
		},
		async (req, reply) => {
			await authService.verifyAccount(req.body, req.log);
			reply.status(200).send({
				status: "success" as const,
				data: "Account verification successful",
			});
		},
	);

	fastify.post(
		"/auth/google",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: config.rateLimit.oauthSignIn,
				},
			},
		},
		async (req, reply) => {
			const url = authService.googleSignInUrl(req);
			reply.redirect(url);
		},
	);

	fastify.get(
		"/auth/google/callback",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: config.rateLimit.oauthSignIn,
				},
			},
			schema: {
				querystring: OAuthRequestQuerySchema,
			},
		},
		async (req, reply) => {
			await authService.googleSignIn(req.query, req, reply);
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
				body: SignInRequestSchema,
				response: {
					200: SuccessResponseSchema(SignInResponseSchema),
					400: Type.Union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Authentication"],
			},
		},
		async (req, reply) => {
			const { uuid, user } = await authService.signIn(req.body, req.log);

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
						email: user.email,
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
				body: ForgotPasswordRequestSchema,
				response: {
					200: SuccessResponseSchema(ForgotPasswordResponseSchema),
					400: Type.Union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Authentication"],
			},
		},
		async (req, reply) => {
			await authService.forgotPassword(req.body, req.log);

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
				body: ResetPasswordRequestSchema,
				response: {
					200: SuccessResponseSchema(ResetPasswordResponseSchema),
					400: Type.Union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Authentication"],
			},
		},
		async (req, reply) => {
			await authService.resetPassword(req.body, req.log);

			reply.status(200).send({
				status: "success",
				data: "Reset password successful",
			});
		},
	);

	fastify.post(
		"/auth/logout",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: config.rateLimit.logoutLimit,
				},
			},
			preHandler: async (req, reply) => await req.authenticate(reply),
		},
		async (req, reply) => {
			await authService.logout(req);

			reply.status(200).clearCookie(config.application.sessionName).send();
		},
	);
};

export default plugin;
