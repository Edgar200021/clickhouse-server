import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function runSeed() {
	const { stderr } = await execAsync("npm run seed:run");
	if (stderr) {
		throw new Error(`Seed error: ${stderr}`);
	}
}
