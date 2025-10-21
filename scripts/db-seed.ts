import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function runSeed(databaseUrl?: string) {
	const { stderr } = await execAsync("npm run seed:run", {
		env: {
			...process.env,
			DATABASE_URL: databaseUrl || process.env.DATABASE_URL,
		},
	});
	if (stderr) {
		throw new Error(`Seed error: ${stderr}`);
	}
}
