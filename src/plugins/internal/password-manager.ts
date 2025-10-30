import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import fp from "fastify-plugin";

declare module "fastify" {
	export interface FastifyInstance {
		passwordManager: typeof passwordManager;
	}
}

const SCRYPT_KEYLEN = 32;
const SCRYPT_COST = 65536;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 2;
const SCRYPT_MAXMEM = 128 * SCRYPT_COST * SCRYPT_BLOCK_SIZE * 2;

const passwordManager = {
	hash: scryptHash,
	compare,
};

export async function scryptHash(value: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const salt = randomBytes(Math.min(16, SCRYPT_KEYLEN / 2));

		scrypt(
			value,
			salt,
			SCRYPT_KEYLEN,
			{
				cost: SCRYPT_COST,
				blockSize: SCRYPT_BLOCK_SIZE,
				parallelization: SCRYPT_PARALLELIZATION,
				maxmem: SCRYPT_MAXMEM,
			},
			(error, key) => {
				if (error !== null) {
					reject(error);
				} else {
					resolve(`${salt.toString("hex")}.${key.toString("hex")}`);
				}
			},
		);
	});
}

async function compare(value: string, hash: string): Promise<boolean> {
	const [salt, hashed] = hash.split(".");
	const saltBuffer = Buffer.from(salt, "hex");
	const hashedBuffer = Buffer.from(hashed, "hex");

	return new Promise((resolve) => {
		scrypt(
			value,
			saltBuffer,
			SCRYPT_KEYLEN,
			{
				cost: SCRYPT_COST,
				blockSize: SCRYPT_BLOCK_SIZE,
				parallelization: SCRYPT_PARALLELIZATION,
				maxmem: SCRYPT_MAXMEM,
			},
			(error, key) => {
				if (error !== null) {
					timingSafeEqual(hashedBuffer, hashedBuffer);
					resolve(false);
				} else {
					resolve(timingSafeEqual(key, hashedBuffer));
				}
			},
		);
	});
}

export default fp(
	async (fastify) => {
		fastify.decorate("passwordManager", passwordManager);
	},
	{
		name: "password-manager",
	},
);
