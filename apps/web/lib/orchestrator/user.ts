/** The demo runs as one employee. Real auth is out of scope; see docs/PRD.md. */
export function currentUser(): string {
  return process.env.DEMO_USER ?? 'Yuki Tanaka';
}
