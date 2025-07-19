import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		server: {
			deps: {
				inline: ["@fastify/autoload"],
			},
		},
		fileParallelism: false,
		isolate: false,
		testTimeout: 30000,
	},
});
