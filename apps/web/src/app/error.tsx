'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="p-10">
      <h1>This page could not be displayed.</h1>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
