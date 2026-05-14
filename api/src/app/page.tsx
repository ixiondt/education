/* Minimal status page — confirms the deployment is reachable.
 * The real app is the PWA at https://letters.guardcybersolutionsllc.com/
 * which talks to this backend via /api/* paths on the same origin. */

export default function HomePage() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        Letters &amp; Numbers — API
      </h1>
      <p style={{ color: '#6E5C49', lineHeight: 1.5 }}>
        Backend for the educational PWA. The actual app lives at{' '}
        <a href="https://letters.guardcybersolutionsllc.com/" style={{ color: '#B86B4D' }}>
          letters.guardcybersolutionsllc.com
        </a>.
      </p>
      <ul style={{ marginTop: 24, color: '#6E5C49', fontSize: 14, lineHeight: 1.8 }}>
        <li><code>GET /api/health</code> — liveness + db ping</li>
        <li><code>GET /api/sync/probe</code> — readiness + schema check</li>
      </ul>
      <p style={{ marginTop: 32, fontSize: 12, color: '#9A8B78' }}>
        v0.1 · {process.env.NODE_ENV ?? 'unknown'}
      </p>
    </main>
  );
}
