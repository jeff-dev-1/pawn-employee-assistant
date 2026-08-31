import { announce, serveHttp } from '@pawn/mcp-kit';
import { loadConfig } from './config.js';
import { policyServer } from './definition.js';

const config = loadConfig();
serveHttp(policyServer, config.port);
announce(policyServer, config.orchestratorUrl, `http://localhost:${config.port}/mcp`);
