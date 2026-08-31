import type { NextConfig } from 'next';

const config: NextConfig = {
  // Next 16 otherwise writes its own CLAUDE.md and AGENTS.md into apps/web on first run.
  // The L1 contract at the repository root stays the only CLAUDE.md.
  agentRules: false,
};

export default config;
