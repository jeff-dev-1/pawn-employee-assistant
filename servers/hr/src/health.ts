/** What /health reports. The HTTP wiring lives in @pawn/mcp-kit; this is the content. */
export type Health = { status: 'ok' | 'degraded'; server: string; version: string };

export function health(server: string, version: string): Health {
  return { status: 'ok', server, version };
}
