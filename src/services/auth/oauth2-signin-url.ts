import {AuthService} from "./auth.service.js";
import {GenOAuthRedirectUrlQuery} from "@/schemas/auth/oauth.schema.js";
import {FastifyRequest} from "fastify/types/request.js";
import {randomUUID} from "node:crypto";
import {OAuthRedirectPathSeparator} from "@/const/cookie.js";
import {OAuth2Provider} from "@/types/oauth2.js";

export function oauth2SignInUrl(
	this: AuthService,
	req: FastifyRequest,
	query: GenOAuthRedirectUrlQuery,
	provider: OAuth2Provider,
) {
	const {oAuth2Manager} = this.fastify

	const redirectUri = this.generateRedirectUri(req, provider);
	const safeFrom = query.from ? encodeURIComponent(query.from) : "";

	const uuid = randomUUID();

	const url = oAuth2Manager.generateRedirectUrl(
		redirectUri,
		provider,
		query.from ? `${uuid}${OAuthRedirectPathSeparator}${safeFrom}` : uuid,
	);

	return {url, cookieState: uuid};
}