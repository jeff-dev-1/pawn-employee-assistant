import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, resolve } from 'node:path';

export type HrConfig = { port: number; dataFile: string; orchestratorUrl: string };

// servers/hr/src/config.ts -> the repository root is three directories up. Resolving
// against the module rather than the working directory is not a nicety: whoever launches
// this process picks its cwd, and Claude Desktop's cwd is not this repository.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** Ports and paths come from the environment. A bad value fails here, by name, not later. */
export function loadConfig(): HrConfig {
  const port = Number(process.env.HR_PORT ?? 3101);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`HR_PORT must be a positive integer, got ${process.env.HR_PORT}`);
  }
  const file = process.env.HR_DATA_FILE ?? 'data/employees.csv';
  return {
    port,
    dataFile: isAbsolute(file) ? file : resolve(ROOT, file),
    orchestratorUrl: process.env.ORCHESTRATOR_URL ?? 'http://localhost:3000',
  };
}
