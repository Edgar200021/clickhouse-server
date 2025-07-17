import fastifyCookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("Plugins", () => {
	let app: FastifyInstance;

	beforeEach(async () => {
		app = Fastify();
		await app.register(fastifyCookie);

		app.get("/", (_, reply) =>
			reply
				.status(200)
				.cookie("test", "string", {
					maxAge: 1000,
				})
				.send(),
		);

		app.get("/remove", (_, reply) =>
			reply.status(200).clearCookie("test").send(),
		);
	});

	afterEach(async () => await app.close());

	describe("@fastify/cookie", () => {
		it("Should set cookie", async () => {
			const res = await app.inject({ method: "GET", path: "/" });
			const cookie = res.cookies.find((cookie) => cookie.name === "test");

			expect(cookie).toBeDefined();
			expect(cookie?.value).equal("string");
			expect(cookie?.maxAge).equal(1000);
		});

		it("Should remove cookie", async () => {
			const setRes = await app.inject({ method: "GET", path: "/" });
			const setCookie = setRes.cookies.find((cookie) => cookie.name === "test");

			expect(setCookie).toBeDefined();
			expect(setCookie?.value).equal("string");

			const res = await app.inject({ method: "GET", path: "/remove" });

			const removedCookie = res.cookies.find(
				(cookie) => cookie.name === "test",
			);

			expect(removedCookie).toBeDefined();
			expect(removedCookie?.value).toBe("");
			expect(removedCookie?.maxAge).toBe(0);
		});
	});
});
