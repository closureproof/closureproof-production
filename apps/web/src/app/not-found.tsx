import Link from 'next/link';
export default function NotFound() {
  return (
    <main id="main" className="p-10">
      <h1>Page not found</h1>
      <p>This address does not match an available page.</p>
      <Link href="/">Back to home</Link>
    </main>
  );
}
