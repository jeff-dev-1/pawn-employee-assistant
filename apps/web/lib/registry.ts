export type RegisteredAgent = {
  name: string;
  url: string;
  description: string;
  tools: { name: string; description: string }[];
  registeredAt: number;
};

/** In-memory and empty for now. Nothing here knows the name of any server. */
const agents = new Map<string, RegisteredAgent>();

export function listAgents(): RegisteredAgent[] {
  return [...agents.values()];
}
