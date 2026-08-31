import type { ServerDefinition } from '@pawn/mcp-kit';
import { registerTools } from './tools/index.js';

export const policyServer: ServerDefinition = {
  name: 'policy',
  version: '0.1.0',
  description: 'The company handbook: attendance, leave, expenses, remote work, equipment, security, onboarding and offboarding.',
  register: registerTools,
};
