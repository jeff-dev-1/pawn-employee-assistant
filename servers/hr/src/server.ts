import { announce, serveHttp } from '@pawn/mcp-kit';
import { loadConfig } from './config.js';
import { hrServer } from './definition.js';

const config = loadConfig();
serveHttp(hrServer, config.port);
announce(hrServer, config.orchestratorUrl, `http://localhost:${config.port}/mcp`);
