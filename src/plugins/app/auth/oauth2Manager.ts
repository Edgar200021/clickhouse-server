import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import {
	GoogleOAuth2AccessTokenSchema,
	GoogleOAuth2Token,
	GoogleOAuth2User,
	GoogleOAuth2UserSchema,
} from "../../../schemas/auth/oauth.schema.js";

declare module "fastify" {
	export interface FastifyInstance {
		oAuth2Manager: ReturnType<typeof createoAuth2Manager>;
	}
}

function createoAuth2Manager(fastify: FastifyInstance) {
	const { oauth } = fastify.config;

	function generateGoogleRedirectUrl(redirectUri: string) {
		const clientId = oauth.googleClientId;

		const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");

		url.searchParams.set("client_id", clientId);
		url.searchParams.set("redirect_uri", redirectUri);
		url.searchParams.set("response_type", "code");
		url.searchParams.set("scope", "email profile");
		url.searchParams.set("prompt", "consent");

		const authUrl = url.toString();

		return authUrl;
	}

	async function getUserInfo(
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

	return {
		generateGoogleRedirectUrl,
		getUserInfo,
	};
}

export default fp(
	async (instance) => {
		instance.decorate("oAuth2Manager", createoAuth2Manager(instance));
	},
	{ name: "oauth" },
);
