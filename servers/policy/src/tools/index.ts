import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadConfig } from '../config.js';
import { loadPolicies, searchPolicy } from '../policies.js';

export function registerTools(server: McpServer): void {
  const policies = loadPolicies(loadConfig().policyDir);

  server.registerTool(
    'search_policy',
    {
      description:
        'Search the company handbook and return the matching passages with their document ' +
        'titles. Use this for any question about company rules: attendance, leave, expenses, ' +
        'remote work, equipment, information security, onboarding and offboarding.',
      inputSchema: { query: z.string().describe('What the employee wants to know about') },
    },
    async ({ query }) => ({
      content: [{ type: 'text' as const, text: JSON.stringify(searchPolicy(policies, query)) }],
    }),
  );
}
