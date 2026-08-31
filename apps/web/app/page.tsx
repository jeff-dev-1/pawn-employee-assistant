'use client';

import { useState } from 'react';

/** Minimal chat UI. It echoes: there is nothing to ask yet, and that is the point. */
export default function Page() {
  const [question, setQuestion] = useState('');
  const [echo, setEcho] = useState('');

  return (
    <main style={{ maxWidth: 640, margin: '4rem auto', fontFamily: 'system-ui' }}>
      <h1>Employee Assistant</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setEcho(question);
        }}
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask a question"
          style={{ width: '100%', padding: '0.5rem' }}
        />
      </form>
      {echo !== '' && <p>You asked: {echo}</p>}
    </main>
  );
}
