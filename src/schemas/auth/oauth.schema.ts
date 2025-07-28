import { type Static, Type } from "@sinclair/typebox";

export const GenOAuthRedirectUrlQuerySchema = Type.Object({
	from: Type.Optional(Type.String()),
});
export const OAuthRequestQuerySchema = Type.Object({
	code: Type.String(),
	state: Type.String(),
});

export const GoogleOAuth2AccessTokenSchema = Type.Object({
	access_token: Type.String(),
});

export const GoogleOAuth2UserSchema = Type.Object({
	id: Type.String(),
	email: Type.String({ format: "email" }),
	verified_email: Type.Boolean(),
});

export const FacebookOAuth2AccessTokenSchema = Type.Union([
	Type.Object({
		access_token: Type.String(),
	}),
	Type.Object({
		error: Type.Object({
			message: Type.String(),
		}),
	}),
]);

export const FacebookOAuth2UserSchema = Type.Object({
	id: Type.String(),
	email: Type.String({ format: "email" }),
});

export type GenOAuthRedirectUrlQuery = Static<
	typeof GenOAuthRedirectUrlQuerySchema
>;
export type OAuthRequqestQuery = Static<typeof OAuthRequestQuerySchema>;

export type GoogleOAuth2Token = Static<typeof GoogleOAuth2AccessTokenSchema>;
export type GoogleOAuth2User = Static<typeof GoogleOAuth2UserSchema>;

export type FacebookOAuth2Token = Static<
	typeof FacebookOAuth2AccessTokenSchema
>;
export type FacebookOAuth2User = Static<typeof FacebookOAuth2UserSchema>;
