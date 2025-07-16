import { expect, it } from "vitest";
import { buildTestApp } from "../testApp.js";

describe("Not Found", () => {
	it("Should return 404 status code when route doesn't exist", async () => {
		const { app } = await buildTestApp();

		const res = await app.inject({
			method: "GET",
			path: "/not-existing-route",
		});

		expect(res.statusCode).toEqual(404);
		expect(JSON.parse(res.body)).toStrictEqual({ message: "Not Found" });
	});

	it("Should be rate limited", async () => {
		const { app } = await buildTestApp();

		for (let i = 0; i < app.config.rateLimit.notFoundLimit!; i++) {
			const res = await app.inject({
				method: "GET",
				path: "/not-existing-route",
			});

			expect(res.statusCode).toEqual(404);
		}

		const lastRes = await app.inject({
			method: "GET",
			path: "/not-existing-route",
		});

		expect(lastRes.statusCode).toEqual(429);
	});
});
