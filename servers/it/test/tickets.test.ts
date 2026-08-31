import { describe, expect, it } from 'vitest';
import { getTicket, listTickets, openDatabase } from '../src/tickets.js';

const db = openDatabase(new URL('./fixture.csv', import.meta.url).pathname);

describe('list_tickets', () => {
  it('filters by approver', () => {
    expect(listTickets(db, { approver: 'Bo Lead' }).tickets.map((t) => t.id)).toEqual(['T-2', 'T-1']);
  });

  it('combines filters', () => {
    expect(listTickets(db, { approver: 'Bo Lead', status: 'resolved' }).tickets).toHaveLength(1);
  });

  it('returns an empty list rather than an error when nothing matches', () => {
    expect(listTickets(db, { assignee: 'Nobody' }).tickets).toEqual([]);
  });
});

describe('get_ticket', () => {
  it('finds one by id', () => {
    expect(getTicket(db, 'T-1')).toMatchObject({ title: 'First' });
  });

  it('returns a structured not_found', () => {
    expect(getTicket(db, 'T-999')).toEqual({ status: 'not_found', detail: 'No ticket T-999' });
  });
});
