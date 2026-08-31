/** Proves both model roles answer on the currently selected channel. */
import { generateText } from 'ai';
import { activeChannel, planner, writer } from '../apps/web/lib/llm.js';

async function probe(role: string, model: ReturnType<typeof planner>, prompt: string) {
  const started = Date.now();
  const { text } = await generateText({ model, prompt });
  console.log(
    `${role.padEnd(8)} ${String(Date.now() - started).padStart(6)}ms  ${text.slice(0, 80).replace(/\n/g, ' ')}`,
  );
}

console.log(`channel: ${activeChannel()}`);
await probe('planner', planner(), 'Reply with the single word: ready');
await probe('writer', writer(), 'In one sentence, tell an employee where to find the leave policy.');
