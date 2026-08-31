import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { NextConfig } from 'next';

// Next reads .env from the directory it runs in, which under npm workspaces is apps/web.
// This repository keeps one .env at the root, so load it here. Values already present in
// the environment win, which is what lets docker compose's env_file take precedence.
function loadRootEnv() {
  try {
    const text = readFileSync(join(process.cwd(), '..', '..', '.env'), 'utf8');
    for (const line of text.split('\n')) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (match?.[1] && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2]?.replace(/^["']|["']$/g, '') ?? '';
      }
    }
  } catch {
    // No root .env is fine: a container gets its configuration from env_file.
  }
}

loadRootEnv();

const config: NextConfig = {
  // Next 16 otherwise writes its own CLAUDE.md and AGENTS.md into apps/web on first run.
  // The L1 contract at the repository root stays the only CLAUDE.md.
  agentRules: false,
};

export default config;
