export type HrConfig = { port: number; dataFile: string; orchestratorUrl: string };

/** Ports come from the environment. A bad value fails here, by name, not later. */
export function loadConfig(): HrConfig {
  const port = Number(process.env.HR_PORT ?? 3101);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`HR_PORT must be a positive integer, got ${process.env.HR_PORT}`);
  }
  return {
    port,
    dataFile: process.env.HR_DATA_FILE ?? 'data/employees.csv',
    orchestratorUrl: process.env.ORCHESTRATOR_URL ?? 'http://localhost:3000',
  };
}
