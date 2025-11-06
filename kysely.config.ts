import { CamelCasePlugin } from "kysely";
import { defineConfig, getKnexTimestampPrefix } from "kysely-ctl";
import pg from "pg";

const dialectConfig = {
	pool: new pg.Pool({
		connectionString: process.env.DATABASE_URL,
	}),
};

const migrations = {
	migrationFolder: "migrations",
	getMigrationPrefix: getKnexTimestampPrefix,
};

const seeds = {
	seedFolder: "seeds",
	getSeedPrefix: getKnexTimestampPrefix,
};

const plugins = [new CamelCasePlugin()];

export default defineConfig({
	dialect: "pg",
	$env: {
		development: {
			dialectConfig,
			migrations,
			seeds,
			plugins,
		},
	},
	dialectConfig,
	migrations,
	seeds,
	plugins,
});
