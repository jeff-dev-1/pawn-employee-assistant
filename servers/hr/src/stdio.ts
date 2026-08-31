#!/usr/bin/env -S npx tsx
import { serveStdio } from '@pawn/mcp-kit';
import { hrServer } from './definition.js';

// The whole stdio entry. Same registration, different transport - which is the point.
await serveStdio(hrServer);
