import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadConfig } from '../config.js';
import { getTicket, listTickets, openDatabase } from '../tickets.js';

const structured = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
});

export function registerTools(server: McpServer): void {
  const db = openDatabase(loadConfig().dataFile);

  server.registerTool(
    'list_tickets',
    {
      description:
        'List IT support tickets, filtered by any combination of requester, assignee, ' +
        'approver and status. Use this for questions about which tickets someone opened, ' +
        'is working on, or is waiting to approve. Status is one of: unassigned, ' +
        'in_progress, awaiting_approval, resolved, rejected.',
      inputSchema: {
        requester: z.string().optional().describe('Who opened the ticket'),
        assignee: z.string().optional().describe('Who is working on it'),
        approver: z.string().optional().describe('Who must approve it'),
        status: z.string().optional().describe('Ticket status'),
      },
    },
    async (args) => structured(listTickets(db, args)),
  );

  server.registerTool(
    'get_ticket',
    {
      description: 'Fetch one IT ticket by its id, for example T-1001.',
      inputSchema: { id: z.string().describe('Ticket id, e.g. T-1001') },
    },
    async ({ id }) => structured(getTicket(db, id)),
  );
}
