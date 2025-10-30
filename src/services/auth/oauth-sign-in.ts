import type {OAuthRequqestQuery} from "@/schemas/auth/oauth.schema.js";
import type {FastifyReply, FastifyRequest} from "fastify";
import type {OAuth2Provider} from "@/types/oauth2.js";
import {OAauthSessionPrefix, OAuthRedirectPathSeparator} from "@/const/cookie.js";
import {assertValidUser} from "@/utils/user.utils.js";
import {AuthService} from "./auth.service.js";
import {sql} from "kysely";

export async function oauthSignIn(
	this: AuthService,
	data: OAuthRequqestQuery,
	req: FastifyRequest,
	reply: FastifyReply,
	provider: OAuth2Provider,
) {
	const {
		fastify: {config, kysely, httpErrors, oAuth2Manager, cartService},
		generateRedirectUri,
		oauthProviderToColumn,
		generateSession
	} = this

	const {code, state} = data;
	const [uuidPart, fromPart] = state.split(OAuthRedirectPathSeparator);
	const fromDecoded = fromPart ? decodeURIComponent(fromPart) : "";

	const cookieState = req.cookies[config.application.oauthStateCookieName];
	if (!cookieState) {
		req.log.info("OAuth failed: state not found in cookie");
		return reply.badRequest("Invalid state");
	}

	const unsigned = req.unsignCookie(cookieState);
	if (!unsigned.valid || unsigned.value !== uuidPart) {
		req.log.info("OAuth failed: invalid state");
		return reply.badRequest("Invalid state");
	}

	const redirectUri = generateRedirectUri(req, provider);

	const oauthUser = await oAuth2Manager.getUserInfo(
		redirectUri,
		code,
		provider,
		(err) => {
			req.log.error({err}, "OAuth failed:");
		},
	);

	if ("verified_email" in oauthUser && !oauthUser.verified_email) {
		return reply.redirect(`${config.application.clientUrl}`);
	}

	const oauthColumn = oauthProviderToColumn(provider);
	const redirectUrl = `${config.application.clientUrl}${fromDecoded?.startsWith("/") ? fromDecoded : "/"}`;

	const dbUser = await kysely
		.selectFrom("users")
		.select([
			"googleId",
			"facebookId",
			"email",
			"isBanned",
			"isVerified",
			"id",
		])
		.where((eb) =>
			eb.or([
				eb(oauthColumn, "=", oauthUser.id),
				eb("email", "=", oauthUser.email.toLowerCase()),
			]),
		)
		.executeTakeFirst();

	if (!dbUser) {
		return await kysely.transaction().execute(async (trx) => {
			const newUser = await trx
				.insertInto("users")
				.values({
					email: oauthUser.email,
					[oauthColumn]: oauthUser.id,
					isVerified: true,
					createdAt: sql`NOW
          ()`,
				})
				.returning("id")
				.executeTakeFirstOrThrow();

			await cartService.createIfNotExists(newUser, trx);

			const uuid = await generateSession(newUser, "oauth");

			return reply
				.cookie(
					config.application.sessionCookieName,
					`${OAauthSessionPrefix}${uuid}`,
					{
						maxAge: config.application.oauthSessionTTLMinutes * 60,
					},
				)
				.clearCookie(config.application.oauthStateCookieName)
				.redirect(redirectUrl);
		});
	}

	assertValidUser(dbUser, req.log, httpErrors, {
		prefix: "Failed to authorize with oauth:",
		checkConditions: ["banned", "notVerified"],
	});

	if (!dbUser[oauthColumn]) {
		await kysely
			.updateTable("users")
			.set({
				[oauthColumn]: oauthUser.id,
				isVerified: true,
				updatedAt: sql`NOW
        ()`,
			})
			.where("id", "=", dbUser.id)
			.execute();
	}

	await cartService.createIfNotExists(dbUser);

	const uuid = await generateSession(dbUser, "oauth");

	return reply
		.cookie(
			config.application.sessionCookieName,
			`${OAauthSessionPrefix}${uuid}`,
			{
				maxAge: config.application.oauthSessionTTLMinutes * 60,
			},
		)
		.clearCookie(config.application.oauthStateCookieName)
		.redirect(redirectUrl);
}