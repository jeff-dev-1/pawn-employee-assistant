import { describe, expect, it } from 'vitest';
import { findEmployee, getTeam, loadEmployees } from '../src/employees.js';

// A fixture, not the real data file: the tests must not care what the demo data says.
const employees = loadEmployees(new URL('./fixture.csv', import.meta.url).pathname);

describe('find_employee', () => {
  it('finds by name', () => {
    expect(findEmployee(employees, { name: 'Ada Probe' })).toMatchObject({ remaining_leave: 4 });
  });

  it('finds by email, case-insensitively', () => {
    expect(findEmployee(employees, { email: 'CY.PROBE@fixture.example' })).toMatchObject({
      name: 'Cy Probe',
    });
  });

  it('returns a structured not_found rather than throwing', () => {
    expect(findEmployee(employees, { name: 'Nobody At All' })).toEqual({
      status: 'not_found',
      detail: 'No employee matched Nobody At All',
    });
  });

  it('rejects a call with no arguments at all', () => {
    expect(findEmployee(employees, {})).toMatchObject({ status: 'invalid_args' });
  });
});

describe('get_team', () => {
  it('returns the direct reports', () => {
    const team = getTeam(employees, { manager: 'Bo Lead' });
    expect(team).toMatchObject({ manager: 'Bo Lead' });
    expect('reports' in team && team.reports.map((r) => r.name)).toEqual(['Ada Probe', 'Cy Probe']);
  });

  it('returns not_found for a manager with no reports', () => {
    expect(getTeam(employees, { manager: 'Ada Probe' })).toMatchObject({ status: 'not_found' });
  });

  it('rejects a missing manager argument', () => {
    expect(getTeam(employees, {})).toMatchObject({ status: 'invalid_args' });
  });
});
