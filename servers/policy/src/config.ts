import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, resolve } from 'node:path';

export type PolicyConfig = { port: number; policyDir: string; orchestratorUrl: string };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export function loadConfig(): PolicyConfig {
  const port = Number(process.env.POLICY_PORT ?? 3103);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`POLICY_PORT must be a positive integer, got ${process.env.POLICY_PORT}`);
  }
  const dir = process.env.POLICY_DIR ?? 'data/policies';
  return {
    port,
    policyDir: isAbsolute(dir) ? dir : resolve(ROOT, dir),
    orchestratorUrl: process.env.ORCHESTRATOR_URL ?? 'http://localhost:3000',
  };
}
