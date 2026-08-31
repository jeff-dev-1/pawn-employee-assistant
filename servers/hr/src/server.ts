import { serveHttp, type ServerDefinition } from '@pawn/mcp-kit';
import { loadConfig } from './config.js';
import { registerTools } from './tools/index.js';

export const definition: ServerDefinition = {
  name: 'hr',
  version: '0.1.0',
  description: 'Employee records: who someone is, who they report to, and their leave balance.',
  register: registerTools,
};

const config = loadConfig();
serveHttp(definition, config.port);
