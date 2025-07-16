import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import type { FastifyInstance, InjectOptions } from "fastify";
import { dbCreate } from "../scripts/db-create.js";
import { dbMigrate } from "../scripts/db-migrate.js";
import { dbDelete } from "../scripts/dp-delete.js";
import { buildApp } from "../src/app.js";
import { setupConfig } from "../src/config.js";

dotenv.config({ path: ".env.test", override: true });

interface TestApp {
	app: FastifyInstance;
	close: () => Promise<void>;
	signUp: typeof signUp;
}

export async function buildTestApp(): Promise<TestApp> {
	const config = setupConfig();

	config.database.name = randomUUID();
	config.rateLimit.signUpLimit = 30;
	config.rateLimit.notFoundLimit = 30;
	config.logger.logToFile = "false";

	await dbCreate(config.database);
	await dbMigrate(config.database);

	const fastify = await buildApp(config);

	return {
		app: fastify,
		async close() {
			await fastify.close();
			await dbDelete(config.database);
		},
		signUp,
	};
}

async function signUp(
	this: TestApp,
	options?: Omit<InjectOptions, "method" | "url">,
) {
	return await this.app.inject({
		method: "POST",
		url: "/api/v1/auth/sign-up",
		...options,
	});
}
