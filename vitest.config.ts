import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src"),
		},
	},
	test: {
		fileParallelism: true,
		env: loadEnv("test", process.cwd(), ""),
		globals: true,
		server: {
			deps: {
				inline: ["@fastify/autoload"],
			},
		},
		root: "./tests",
		isolate: false,
		testTimeout: 300000,
		hookTimeout: 100000,
		maxConcurrency: 15,
		maxWorkers: 5,
		sequence: {
			concurrent: true,
		},
	},
});
