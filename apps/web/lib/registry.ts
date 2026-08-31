import { fetchTools, type ToolSummary } from './mcp-client';

export type RegisteredAgent = {
  name: string;
  url: string;
  description: string;
  tools: ToolSummary[];
  registeredAt: number;
};

const agents = new Map<string, RegisteredAgent>();

/**
 * A server announces itself; the orchestrator pulls its tool catalog once. Nothing in this
 * file knows the names hr, it or policy — which is why adding an agent needs no change
 * anywhere under apps/web.
 */
export async function registerAgent(input: {
  name: string;
  url: string;
  description: string;
}): Promise<RegisteredAgent> {
  const tools = await fetchTools(input.url);
  const entry: RegisteredAgent = { ...input, tools, registeredAt: Date.now() };
  agents.set(input.name, entry);
  return entry;
}

/** Servers re-announce on a heartbeat; three missed beats means nobody is home. */
const STALE_AFTER_MS = Number(process.env.REGISTER_HEARTBEAT_MS ?? 15_000) * 3;

export function isFresh(agent: RegisteredAgent): boolean {
  return Date.now() - agent.registeredAt < STALE_AFTER_MS;
}

export function listAgents(): RegisteredAgent[] {
  return [...agents.values()];
}

export function getAgent(name: string): RegisteredAgent | undefined {
  return agents.get(name);
}

/**
 * The catalog the planner reads. Tool descriptions carry the domain knowledge.
 *
 * Stale agents stay in the catalog on purpose. A server can die between one heartbeat and
 * the next question, so routing has to survive an unreachable target anyway - and hiding
 * the agent would replace an honest "I could not reach IT" with a silent omission.
 * Staleness is reported by /api/health instead, which is where an operator looks.
 */
export function toolCatalog(): string {
  return listAgents()
    .map((agent) => {
      const tools = agent.tools
        .map(
          (tool) =>
            `  - ${tool.name}: ${tool.description}\n    arguments: ${JSON.stringify(tool.inputSchema)}`,
        )
        .join('\n');
      return `server "${agent.name}" - ${agent.description}\n${tools}`;
    })
    .join('\n\n');
}
