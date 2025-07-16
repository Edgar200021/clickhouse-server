import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { createTransport, type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";

declare module "fastify" {
	interface FastifyInstance {
		nodemailer: Transporter;
	}
}

export const autoConfig = ({
	config: {
		mailer: { host, port, secure, user, password },
	},
}: FastifyInstance): SMTPTransport.Options => ({
	host,
	port,
	secure,
	auth: {
		user,
		pass: password,
	},
});

export default fp(
	async (fastify, opts: SMTPTransport.Options) => {
		fastify.decorate("nodemailer", createTransport(opts));

		fastify.nodemailer.verify((err) => {
			if (err) {
				fastify.log.error(err);
				process.exit(1);
			}
		});

		fastify.addHook("onClose", async () => {
			fastify.nodemailer.close();
		});
	},
	{ name: "nodemailer" },
);
