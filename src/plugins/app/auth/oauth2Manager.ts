import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import {
	FacebookOAuth2AccessTokenSchema,
	type FacebookOAuth2Token,
	type FacebookOAuth2User,
	FacebookOAuth2UserSchema,
	GoogleOAuth2AccessTokenSchema,
	type GoogleOAuth2Token,
	type GoogleOAuth2User,
	GoogleOAuth2UserSchema,
} from "../../../schemas/auth/oauth.schema.js";
import type { OAuth2Provider } from "../../../types/oauth2.js";

declare module "fastify" {
	export interface FastifyInstance {
		oAuth2Manager: ReturnType<typeof createoAuth2Manager>;
	}
}

function createoAuth2Manager(fastify: FastifyInstance) {
	const { oauth } = fastify.config;

	function generateRedirectUrl(
		redirectUri: string,
		provider: OAuth2Provider,
		state?: string,
	) {
		if (provider === "google")
			return generateGoogleRedirectUrl(redirectUri, state);
		if (provider === "facebook")
			return generateFacebookRedirectUrl(redirectUri, state);

		const x: never = provider;
		return x;
	}

	async function getUserInfo<T extends OAuth2Provider>(
		redirectUri: string,
		code: string,
		provider: T,
		onError?: (err: unknown) => void,
	): Promise<T extends "google" ? GoogleOAuth2User : FacebookOAuth2User> {
		if (provider === "google")
			return getGoogleUserInfo(redirectUri, code, onError);
		if (provider === "facebook")
			return getFacebookUserInfo(redirectUri, code, onError);

		const x: never = provider;
		return x;
	}

	function generateGoogleRedirectUrl(redirectUri: string, state?: string) {
		const clientId = oauth.googleClientId;

		const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");

		url.searchParams.set("client_id", clientId);
		url.searchParams.set("redirect_uri", redirectUri);
		url.searchParams.set("response_type", "code");
		url.searchParams.set("scope", "email profile");
		url.searchParams.set("prompt", "consent");
		if (state) {
			url.searchParams.set("state", state);
		}

		const authUrl = url.toString();

		return authUrl;
	}

	function generateFacebookRedirectUrl(redirectUri: string, state?: string) {
		const clientId = oauth.facebookClientId;

		const url = new URL("https://www.facebook.com/v13.0/dialog/oauth");

		url.searchParams.set("client_id", clientId);
		url.searchParams.set("redirect_uri", redirectUri);
		url.searchParams.set("scope", "email");
		url.searchParams.set("response_type", "code");
		if (state) {
			url.searchParams.set("state", state);
		}

		const authUrl = url.toString();

		return authUrl;
	}

	async function getGoogleUserInfo(
		redirectUri: string,
		code: string,
		onError?: (err: unknown) => void,
	): Promise<GoogleOAuth2User> {
		try {
			const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
				method: "POST",
				body: JSON.stringify({
					client_id: oauth.googleClientId,
					client_secret: oauth.googleClientSecret,
					code,
					redirectUri: redirectUri,
					grant_type: "authorization_code",
				}),
			});

			const data = await tokenRes.json();
			if (
				!fastify.ajv.validate<GoogleOAuth2Token>(
					GoogleOAuth2AccessTokenSchema,
					data,
				)
			) {
				throw new Error("GoogleOauth2TokenSchema validation failed");
			}

			const profileRes = await fetch(
				"https://www.googleapis.com/oauth2/v2/userinfo",
				{
					headers: { Authorization: `Bearer ${data.access_token}` },
				},
			);

			const profileData = await profileRes.json();

			if (
				!fastify.ajv.validate<GoogleOAuth2User>(
					GoogleOAuth2UserSchema,
					profileData,
				)
			) {
				throw new Error("GoogleOauth2UserSchema validation failed");
			}

			return profileData;
		} catch (err) {
			onError?.(err);
			throw fastify.httpErrors.internalServerError(
				"Google authentication failed",
			);
		}
	}

	async function getFacebookUserInfo(
		redirectUri: string,
		code: string,
		onError?: (err: unknown) => void,
	): Promise<FacebookOAuth2User> {
		try {
			const url = new URL(
				"https://graph.facebook.com/v13.0/oauth/access_token",
			);

			url.searchParams.set("client_id", oauth.facebookClientId);
			url.searchParams.set("client_secret", oauth.facebookClientSecret);
			url.searchParams.set("code", code);
			url.searchParams.set("redirect_uri", redirectUri);

			const res = await fetch(url.toString());
			const data = await res.json();

			if (
				!fastify.ajv.validate<FacebookOAuth2Token>(
					FacebookOAuth2AccessTokenSchema,
					data,
				)
			) {
				throw new Error("FacebookOauth2TokenSchema validation failed");
			}

			if ("error" in data) {
				throw new Error(data.error.message);
			}

			const { access_token } = data;

			const getUserUrl = new URL("https://graph.facebook.com/v13.0/me");
			getUserUrl.searchParams.set("fields", "name,email");
			getUserUrl.searchParams.set("access_token", access_token);

			const userRes = await fetch(getUserUrl.toString());
			const user = await userRes.json();

			if (
				!fastify.ajv.validate<FacebookOAuth2User>(
					FacebookOAuth2UserSchema,
					user,
				)
			) {
				throw new Error("FacebookOauth2UserSchema validation failed");
			}

			return user;
		} catch (err) {
			onError?.(err);
			throw fastify.httpErrors.internalServerError(
				"Facebook authentication failed",
			);
		}
	}

	return {
		generateRedirectUrl,
		getUserInfo,
	};
}

export default fp(
	async (instance) => {
		instance.decorate("oAuth2Manager", createoAuth2Manager(instance));
	},
	{ name: "oauth" },
);
