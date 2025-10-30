import type {FastifyRequest} from "fastify";
import {FastifyInstance} from "fastify";
import fp from "fastify-plugin"
import {signUp} from "./sign-up.js";
import type {User} from "@/types/db/user.js";
import {randomUUID} from "node:crypto";
import {SessionPrefix} from "@/const/redis.js";
import {signIn} from "./sign-in.js";
import {verifyAccount} from "./verify-account.js";
import {forgotPassword} from "./forgot-password.js";
import {resetPassword} from "./reset-password.js";
import {logout} from "./logout.js";
import type {OAuth2Provider} from "@/types/oauth2.js";
import type {DB} from "@/types/db/db.js";
import {oauthSignIn} from "./oauth-sign-in.js";
import {oauth2SignInUrl} from "./oauth2-signin-url.js";
import {ReferenceExpression} from "kysely";


declare module "fastify" {
	export interface FastifyInstance {
		authService: AuthService
	}
}


export class AuthService {
	signUp = signUp
	signIn = signIn
	logout = logout
	verifyAccount = verifyAccount
	forgotPassword = forgotPassword
	resetPassword = resetPassword
	oauth2SignInUrl = oauth2SignInUrl
	oauthSignIn = oauthSignIn


	constructor(readonly fastify: FastifyInstance) {
		this.generateSession = this.generateSession.bind(this)
		this.generateRedirectUri = this.generateRedirectUri.bind(this)
		this.oauthProviderToColumn = this.oauthProviderToColumn.bind(this)
	}


	async generateSession(
		user: Pick<User, "id">,
		type: "oauth" | "regular",
	) {
		const uuid = randomUUID();

		await this.fastify.redis.setex(
			`${SessionPrefix}${uuid}`,
			60 *
			(type === "regular"
				? this.fastify.config.application.sessionTTLMinutes
				: this.fastify.config.application.oauthSessionTTLMinutes),
			user.id,
		);

		return uuid;
	}

	generateRedirectUri(req: FastifyRequest, type: OAuth2Provider) {
		return `${req.protocol}://${req.host}/api/v1/auth/${type}/callback`;
	}

	oauthProviderToColumn(
		provider: OAuth2Provider,
	): Extract<ReferenceExpression<DB, "users">, "googleId" | "facebookId"> {
		if (provider === "google") return "googleId";
		if (provider === "facebook") return "facebookId";

		const x: never = provider;
		return x;
	}

}


export default fp(async (fastify: FastifyInstance) => {
	fastify.decorate("authService", new AuthService(fastify))
}, {
	name: "authService",
	dependencies: ["oauth"]
})