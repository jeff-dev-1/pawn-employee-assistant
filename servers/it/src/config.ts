import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, resolve } from 'node:path';

export type ItConfig = { port: number; dataFile: string; orchestratorUrl: string };

// Resolved against the module, not the working directory: whoever launches this process
// picks its cwd, and a host such as Claude Desktop does not run inside this repository.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export function loadConfig(): ItConfig {
  const port = Number(process.env.IT_PORT ?? 3102);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`IT_PORT must be a positive integer, got ${process.env.IT_PORT}`);
  }
  const file = process.env.IT_DATA_FILE ?? 'data/tickets.csv';
  return {
    port,
    dataFile: isAbsolute(file) ? file : resolve(ROOT, file),
    orchestratorUrl: process.env.ORCHESTRATOR_URL ?? 'http://localhost:3000',
  };
}
