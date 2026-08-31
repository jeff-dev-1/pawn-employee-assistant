#!/usr/bin/env -S npx tsx
import { serveStdio } from '@pawn/mcp-kit';
import { itServer } from './definition.js';

await serveStdio(itServer);
