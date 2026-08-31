import type { ServerDefinition } from '@pawn/mcp-kit';
import { registerTools } from './tools/index.js';

export const itServer: ServerDefinition = {
  name: 'it',
  version: '0.1.0',
  description: 'IT support tickets: who opened them, who is working on them, who must approve them.',
  register: registerTools,
};
