#!/usr/bin/env tsx
import { spawn } from "child_process";
import { readFile } from "fs/promises";
import path from "path";

type ParsedEnv = Record<string, string>;

const argv = process.argv.slice(2);
if (argv.length < 2) {
	console.error("Usage: npm run env -- <env-file> <cmd> [args...]");
	console.error(
		'Example: npm run env -- .env.local "npx kysely migrate:latest"',
	);
	process.exit(2);
}

const envFile = path.resolve(process.cwd(), argv[0]);
const cmd = argv[1];
const args = argv.slice(2);

function unescapeString(s: string) {
	return s
		.replace(/\\n/g, "\n")
		.replace(/\\r/g, "\r")
		.replace(/\\t/g, "\t")
		.replace(/\\"/g, '"')
		.replace(/\\'/g, "'");
}

function parseEnv(content: string): ParsedEnv {
	const lines = content.split(/\r?\n/);
	const out: ParsedEnv = {};

	for (const rawLine of lines) {
		let line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;

		if (line.startsWith("export ")) {
			line = line.slice("export ".length).trim();
		}

		const eqIndex = line.indexOf("=");
		if (eqIndex === -1) continue;

		const key = line.slice(0, eqIndex).trim();
		let val = line.slice(eqIndex + 1).trim();

		if (!val.startsWith('"') && !val.startsWith("'")) {
			const hashIdx = val.indexOf(" #");
			if (hashIdx !== -1) {
				val = val.slice(0, hashIdx).trim();
			}
		}

		if (
			(val.startsWith('"') && val.endsWith('"')) ||
			(val.startsWith("'") && val.endsWith("'"))
		) {
			val = val.slice(1, -1);
			val = unescapeString(val);
		}

		val = val.replace(/\$\{([^}]+)\}/g, (_, name: string) => {
			if (Object.hasOwn(out, name)) return out[name];
			if (process.env[name] !== undefined) return process.env[name] as string;
			return "";
		});

		out[key] = val;
	}

	return out;
}

async function main() {
	try {
		const raw = await readFile(envFile, { encoding: "utf8" });
		const parsed = parseEnv(raw);

		const childEnv: NodeJS.ProcessEnv = { ...process.env, ...parsed };

		const child = spawn(cmd, args, {
			stdio: "inherit",
			shell: true,
			env: childEnv,
		});

		child.on("exit", (code) => process.exit(code ?? 0));
		child.on("error", (err) => {
			console.error("Failed to start command:", err);
			process.exit(1);
		});
	} catch (err: any) {
		console.error("Failed to read env file:", err?.message ?? err);
		process.exit(1);
	}
}

main();
