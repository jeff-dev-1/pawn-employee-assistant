#!/usr/bin/env -S npx tsx
import { serveStdio } from '@pawn/mcp-kit';
import { policyServer } from './definition.js';

await serveStdio(policyServer);
