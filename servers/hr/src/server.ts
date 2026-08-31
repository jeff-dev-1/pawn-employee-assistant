import { serveHttp } from '@pawn/mcp-kit';
import { loadConfig } from './config.js';
import { hrServer } from './definition.js';

serveHttp(hrServer, loadConfig().port);
