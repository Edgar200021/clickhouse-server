import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
	export interface FastifyInstance {
		emailManager: ReturnType<typeof createEmailManager>;
	}
}

function createEmailManager(fastify: FastifyInstance) {
	const mailer = fastify.nodemailer;

	return {
		async sendVerificationEmail(
			to: string,
			token: string,
			onError?: (err: unknown) => void,
		) {
			const subject = "Email Verification";
			const url = `${fastify.config.application.clientUrl}${fastify.config.application.clientAccountVerificationPath}?token=${encodeURIComponent(token)}`;

			const text = `Please click the link to verify your email: ${url}`;
			const html = `<p>Please click the link to verify your email: <a href="${url}">${url}</a></p>`;

			try {
				await mailer.sendMail({
					to,
					subject,
					text,
					html,
				});
			} catch (error) {
				onError?.(error);
				throw fastify.httpErrors.internalServerError(
					"Failed to send verification email",
				);
			}
		},

		async sendResetPasswordEmail(
			to: string,
			token: string,
			onError?: (err: unknown) => void,
		) {
			const subject = "Password Reset";
			const url = `${fastify.config.application.clientUrl}${fastify.config.application.clientResetPasswordPath}?token=${encodeURIComponent(token)}`;

			const text = `Please click the link to reset your password: ${url}`;
			const html = `<p>Please click the link to reset your password: <a href="${url}">${url}</a></p>`;

			try {
				await fastify.nodemailer.sendMail({
					to,
					subject,
					text,
					html,
				});
			} catch (error) {
				onError?.(error);
				throw fastify.httpErrors.internalServerError(
					"Failed to send verification email",
				);
			}
		},
	};
}

export default fp(
	async (instance: FastifyInstance) => {
		instance.decorate("emailManager", createEmailManager(instance));
	},
	{ dependencies: ["nodemailer"] },
);
