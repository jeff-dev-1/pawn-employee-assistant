import { readFileSync } from 'node:fs';

export type Employee = {
  name: string;
  role: string;
  department: string;
  email: string;
  manager: string;
  remaining_leave: number;
  total_leave: number;
};

export type NotFound = { status: 'not_found'; detail: string };
export type InvalidArgs = { status: 'invalid_args'; detail: string };

/** Minimal CSV reader. The demo data has no quoted fields and no embedded commas. */
export function loadEmployees(file: string): Employee[] {
  const [header, ...rows] = readFileSync(file, 'utf8').trim().split('\n');
  const columns = (header ?? '').split(',');
  return rows.map((row) => {
    const cells = row.split(',');
    const record = Object.fromEntries(columns.map((c, i) => [c, cells[i] ?? '']));
    return {
      name: record.name ?? '',
      role: record.role ?? '',
      department: record.department ?? '',
      email: record.email ?? '',
      manager: record.manager ?? '',
      remaining_leave: Number(record.remaining_leave ?? 0),
      total_leave: Number(record.total_leave ?? 0),
    };
  });
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Parse arguments, query the rows, return the result. A miss is a structured not_found:
 * it does not throw, and it does not apologise in English. Prose is the orchestrator's job.
 */
export function findEmployee(
  employees: Employee[],
  args: { name?: string; email?: string },
): Employee | NotFound | InvalidArgs {
  if (!args.name && !args.email) {
    return { status: 'invalid_args', detail: 'find_employee needs a name or an email' };
  }
  const hit = employees.find(
    (e) =>
      (args.name !== undefined && same(e.name, args.name)) ||
      (args.email !== undefined && same(e.email, args.email)),
  );
  return hit ?? { status: 'not_found', detail: `No employee matched ${args.name ?? args.email}` };
}

export function getTeam(
  employees: Employee[],
  args: { manager?: string },
): { manager: string; reports: Employee[] } | NotFound | InvalidArgs {
  if (!args.manager) {
    return { status: 'invalid_args', detail: 'get_team needs a manager name' };
  }
  const manager = args.manager;
  const reports = employees.filter((e) => same(e.manager, manager));
  if (reports.length === 0) {
    return { status: 'not_found', detail: `Nobody reports to ${manager}` };
  }
  return { manager, reports };
}
