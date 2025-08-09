import z from "zod";

export const GenOAuthRedirectUrlQuerySchema = z.object({
	from: z.string().optional(),
});
export const OAuthRequestQuerySchema = z.object({
	code: z.string(),
	state: z.string(),
});

export const GoogleOAuth2AccessTokenSchema = z.object({
	access_token: z.string(),
});

export const GoogleOAuth2UserSchema = z.object({
	id: z.string(),
	email: z.email(),
	verified_email: z.boolean(),
});

export const FacebookOAuth2AccessTokenSchema = z.union([
	z.object({
		access_token: z.string(),
	}),
	z.object({
		error: z.object({
			message: z.string(),
		}),
	}),
]);

export const FacebookOAuth2UserSchema = z.object({
	id: z.string(),
	email: z.email(),
});

export type GenOAuthRedirectUrlQuery = z.Infer<
	typeof GenOAuthRedirectUrlQuerySchema
>;
export type OAuthRequqestQuery = z.Infer<typeof OAuthRequestQuerySchema>;

export type GoogleOAuth2Token = z.Infer<typeof GoogleOAuth2AccessTokenSchema>;
export type GoogleOAuth2User = z.Infer<typeof GoogleOAuth2UserSchema>;

export type FacebookOAuth2Token = z.Infer<
	typeof FacebookOAuth2AccessTokenSchema
>;
export type FacebookOAuth2User = z.Infer<typeof FacebookOAuth2UserSchema>;
