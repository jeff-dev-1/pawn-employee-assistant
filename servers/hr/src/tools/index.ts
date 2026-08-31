import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadConfig } from '../config.js';
import { findEmployee, getTeam, loadEmployees } from '../employees.js';

const structured = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value) }] });

/**
 * Each tool traces to one row of the mapping table in DESIGN.md. A tool does three things:
 * parse arguments, query the data, return a structured result. It writes no prose.
 */
export function registerTools(server: McpServer): void {
  const employees = loadEmployees(loadConfig().dataFile);

  server.registerTool(
    'find_employee',
    {
      description:
        'Look up one employee record by name or email. Returns role, department, manager, ' +
        'and remaining and total leave days. Use this for any question about who someone is, ' +
        'who they report to, or how much leave they have left.',
      inputSchema: {
        name: z.string().optional().describe('Full name, e.g. "Yuki Tanaka"'),
        email: z.string().optional().describe('Work email address'),
      },
    },
    async (args) => structured(findEmployee(employees, args)),
  );

  server.registerTool(
    'get_team',
    {
      description:
        'List the direct reports of a named manager. Use this when the question is about ' +
        'who works for someone. Requires the manager\'s name.',
      inputSchema: { manager: z.string().describe('The manager\'s full name') },
    },
    async (args) => structured(getTeam(employees, args)),
  );
}
