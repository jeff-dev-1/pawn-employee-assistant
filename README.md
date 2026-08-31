# Employee Assistant

An internal employee assistant. Ask a question in natural language; the system decides which
data domains to consult, fetches from them concurrently, and composes one answer.

At this stage one data domain exists: **HR**, served over MCP.

## Run it

```bash
npm install
cp .env.example .env
npm run dev
curl -s localhost:3000/api/health
curl -s localhost:3101/health
```

## The HR tools

| Tool | Arguments | Returns |
|---|---|---|
| `find_employee` | `name?`, `email?` | the employee record, or `{"status":"not_found"}` |
| `get_team` | `manager` | the manager's direct reports, or `{"status":"not_found"}` |

```bash
npm run smoke          # Streamable HTTP: initialize -> tools/list -> tools/call
npm run smoke:stdio    # the same handshake over stdio
```

Sample output:

```
{"name":"Dana Reeve","role":"Frontend Engineer","department":"Engineering",
 "email":"dana.reeve@acme.example","manager":"Tomas Berg","remaining_leave":25,"total_leave":25}
{"status":"not_found","detail":"No employee matched Nobody Here"}
```

## Register it with a host

Claude Desktop accepts **stdio servers only**. Pasting an HTTP URL is silently ignored, and
in the worst case the whole `mcpServers` block is dropped on the next save. Every path below
is absolute: the host does not inherit this repository as its working directory.

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pawn-hr": {
      "command": "npx",
      "args": ["tsx", "/Users/zoujun/Documents/workspace/pawn-replay/servers/hr/src/stdio.ts"],
      "env": {
        "HR_DATA_FILE": "/Users/zoujun/Documents/workspace/pawn-replay/data/employees.csv"
      }
    }
  }
}
```

Restart Claude Desktop **completely** — it only reloads this file on a full restart — then
ask "Who is Dana Reeve's manager?".

Cursor (`.cursor/mcp.json`) takes the same shape:

```json
{
  "mcpServers": {
    "pawn-hr": {
      "command": "npx",
      "args": ["tsx", "/Users/zoujun/Documents/workspace/pawn-replay/servers/hr/src/stdio.ts"]
    }
  }
}
```
