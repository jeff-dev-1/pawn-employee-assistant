import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * The tool registration slot. Empty on purpose at this stage: having no capability yet is
 * the correct state, and `tools/list` answering "method not found" proves it. Capabilities
 * are earned by registering a tool, not declared in the constructor.
 */
export function registerTools(_server: McpServer): void {}
