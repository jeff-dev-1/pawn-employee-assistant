import type { ServerDefinition } from '@pawn/mcp-kit';
import { registerTools } from './tools/index.js';

/** One capability description, shared by both transports. Nothing here knows about HTTP. */
export const hrServer: ServerDefinition = {
  name: 'hr',
  version: '0.1.0',
  description: 'Employee records: people, roles, departments, managers and leave balances.',
  register: registerTools,
};
