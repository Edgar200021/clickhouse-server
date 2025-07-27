import { Static, Type } from "@sinclair/typebox";

export const OAuthRequestQuerySchema = Type.Object({
	code: Type.String(),
});

export const GoogleOAuth2UserSchema = Type.Object({
	id: Type.String(),
	email: Type.String({ format: "email" }),
	verified_email: Type.Boolean(),
	name: Type.String(),
	given_name: Type.String(),
	family_name: Type.String(),
	picture: Type.String({ format: "uri" }),
});

export const GoogleOAuth2AccessTokenSchema = Type.Object({
	access_token: Type.String(),
});

export type OAuthRequqestQuery = Static<typeof OAuthRequestQuerySchema>;
export type GoogleOAuth2User = Static<typeof GoogleOAuth2UserSchema>;
export type GoogleOAuth2Token = Static<typeof GoogleOAuth2AccessTokenSchema>;
