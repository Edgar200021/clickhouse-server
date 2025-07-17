import { loadEnvFile } from "node:process";
import closeWithGrace from "close-with-grace";
import { buildApp } from "./app.js";
import { setupConfig } from "./config.js";

loadEnvFile(".env");

const config = setupConfig();
const app = await buildApp(config);

closeWithGrace(
	{ delay: Number(app.config.application.fastifyCloseGraceDelay) || 500 },
	async ({ err, signal }) => {
		if (err) {
			app.log.fatal({ err }, "server closing with error");
		} else {
			app.log.info(`${signal} received, server closing`);
		}
		await app.close();
	},
);

const { port, host } = app.config.application;
try {
	await app.listen({
		host: host,
		port: port,
	});
} catch (err) {
	app.log.error(err);
	process.exit(1);
}
