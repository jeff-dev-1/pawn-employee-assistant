import { announce, serveHttp } from '@pawn/mcp-kit';
import { loadConfig } from './config.js';
import { itServer } from './definition.js';

const config = loadConfig();
serveHttp(itServer, config.port);
announce(itServer, config.orchestratorUrl, process.env.ADVERTISE_URL ?? `http://localhost:${config.port}/mcp`);
