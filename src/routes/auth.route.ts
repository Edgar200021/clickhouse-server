import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import z from "zod";
import {
	ForgotPasswordRequestSchema,
	ForgotPasswordResponseSchema,
} from "../schemas/auth/forgot-password.schema.js";
import {
	GenOAuthRedirectUrlQuerySchema,
	OAuthRequestQuerySchema,
} from "../schemas/auth/oauth.schema.js";
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

const plugin: FastifyPluginAsyncZod = async (fastify) => {
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
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
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
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
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

	fastify.get(
		"/auth/google",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: config.rateLimit.oauthSignIn,
				},
			},
			schema: {
				querystring: GenOAuthRedirectUrlQuerySchema,
				tags: ["Authentication"],
			},
		},
		async (req, reply) => {
			const { url, cookieState } = authService.oauth2SignInUrl(
				req,
				req.query,
				"google",
			);

			reply
				.setCookie(config.application.oauthStateCookieName, cookieState, {
					maxAge: 60 * config.application.oauthStateTTlMinutes,
				})
				.redirect(url);
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
				tags: ["Authentication"],
			},
		},
		async (req, reply) => {
			await authService.oauthSignIn(req.query, req, reply, "google");
		},
	);

	fastify.get(
		"/auth/facebook",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: config.rateLimit.oauthSignIn,
				},
			},
			schema: {
				querystring: GenOAuthRedirectUrlQuerySchema,
				tags: ["Authentication"],
			},
		},
		async (req, reply) => {
			const { url, cookieState } = authService.oauth2SignInUrl(
				req,
				req.query,
				"facebook",
			);
			reply
				.setCookie(config.application.oauthStateCookieName, cookieState, {
					maxAge: 60 * config.application.oauthStateTTlMinutes,
				})
				.redirect(url);
		},
	);

	fastify.get(
		"/auth/facebook/callback",
		{
			config: {
				rateLimit: {
					timeWindow: "1 minute",
					max: config.rateLimit.oauthSignIn,
				},
			},
			schema: {
				querystring: OAuthRequestQuerySchema,
				tags: ["Authentication"],
			},
		},
		async (req, reply) => {
			await authService.oauthSignIn(req.query, req, reply, "facebook");
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
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Authentication"],
			},
		},
		async (req, reply) => {
			const { uuid, user } = await authService.signIn(req.body, req.log);

			reply
				.status(200)
				.cookie(config.application.sessionCookieName, uuid, {
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
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
				},
				tags: ["Authentication"],
			},
		},
		async (req, reply) => {
			await authService.forgotPassword(req.body, req.log);

			reply.status(200).send({
				status: "success",
				data: null,
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
					400: z.union([ErrorResponseSchema, ValidationErrorResponseSchema]),
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
			schema: {
				tags: ["Authentication"],
			},
		},
		async (req, reply) => {
			await authService.logout(req);

			reply
				.status(200)
				.clearCookie(config.application.sessionCookieName)
				.send();
		},
	);
};

export default plugin;
