import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';

export type Ticket = {
  id: string;
  title: string;
  status: string;
  requester: string;
  assignee: string;
  approver: string;
  created_at: string;
};

/**
 * Real SQL, seeded in memory from a CSV. The CSV is what students read and edit; SQLite is
 * what answers the query. No file to build, nothing to migrate, and no native database
 * lying around in the repository.
 */
export function openDatabase(csvFile: string): Database.Database {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE tickets (
    id TEXT PRIMARY KEY, title TEXT, status TEXT,
    requester TEXT, assignee TEXT, approver TEXT, created_at TEXT)`);
  const insert = db.prepare(
    'INSERT INTO tickets VALUES (@id, @title, @status, @requester, @assignee, @approver, @created_at)',
  );
  for (const line of readFileSync(csvFile, 'utf8').trim().split('\n').slice(1)) {
    const [id, title, status, requester, assignee, approver, created_at] = line.split(',');
    insert.run({
      id: id ?? '',
      title: title ?? '',
      status: status ?? '',
      requester: requester ?? '',
      assignee: assignee ?? '',
      approver: approver ?? '',
      created_at: created_at ?? '',
    });
  }
  return db;
}

export type NotFound = { status: 'not_found'; detail: string };

export function listTickets(
  db: Database.Database,
  args: { assignee?: string; approver?: string; status?: string; requester?: string },
): { tickets: Ticket[] } {
  const where: string[] = [];
  const params: Record<string, string> = {};
  for (const key of ['assignee', 'approver', 'status', 'requester'] as const) {
    const value = args[key];
    if (value !== undefined && value !== '') {
      where.push(`${key} = @${key} COLLATE NOCASE`);
      params[key] = value;
    }
  }
  const sql = `SELECT * FROM tickets ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC`;
  return { tickets: db.prepare(sql).all(params) as Ticket[] };
}

export function getTicket(db: Database.Database, id: string): Ticket | NotFound {
  const row = db.prepare('SELECT * FROM tickets WHERE id = ? COLLATE NOCASE').get(id) as
    | Ticket
    | undefined;
  return row ?? { status: 'not_found', detail: `No ticket ${id}` };
}
