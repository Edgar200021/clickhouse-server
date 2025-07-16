import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		server: {
			deps: {
				inline: ["@fastify/autoload"],
			},
		},
		poolOptions: {
			// threads: {
			// 	isolate: true,
			// },
		},
		testTimeout: 150_000,
		hookTimeout: 120_000,
	},
});
