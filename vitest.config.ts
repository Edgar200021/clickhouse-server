import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		env: loadEnv("test", process.cwd(), ""),
		globals: true,
		fileParallelism: true,
		server: {
			deps: {
				inline: ["@fastify/autoload"],
			},
		},
		root: "./tests",
		// isolate: false,
		testTimeout: 50000,
		hookTimeout: 30000,
		maxConcurrency: 20,
		sequence: {
			concurrent: true,
		},
	},
});
