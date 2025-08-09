import type { FastifyInstance } from "fastify/types/instance.js";
import fp from "fastify-plugin";
import { CamelCasePlugin, Kysely, PostgresDialect, sql } from "kysely";
import { Pool, type PoolConfig } from "pg";
import type { DB } from "../../types/db/db.js";

declare module "fastify" {
	export interface FastifyInstance {
		kysely: Kysely<DB>;
	}
}

export const autoConfig = (fastify: FastifyInstance): PoolConfig => {
	const { name, host, port, user, password, ssl, poolMin, poolMax } =
		fastify.config.database;

	return {
		database: name,
		host,
		port,
		user,
		password,
		ssl,
		min: poolMin,
		max: poolMax,
	};
};

export default fp(
	async (fastify: FastifyInstance, opts: PoolConfig) => {
		const dialect = new PostgresDialect({
			pool: new Pool(opts),
		});
		fastify.decorate(
			"kysely",
			new Kysely<DB>({ dialect, plugins: [new CamelCasePlugin()] }),
		);

		await sql`SELECT 1`.execute(fastify.kysely);

		fastify.addHook("onClose", async () => {
			await fastify.kysely.destroy();
		});
	},
	{ name: "kysely" },
);
