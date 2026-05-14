import type { Metadata, Viewport } from 'next';

/* Letters & Numbers backend — minimal app shell.
 * This is an API-mostly app; the only HTML page is the index status page. */

export const metadata: Metadata = {
  title: 'Letters & Numbers API',
  description: 'Backend for the Letters & Numbers educational PWA.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          margin: 0,
          padding: '40px 24px',
          background: '#F5EFE4',
          color: '#3A2D20',
          minHeight: '100vh',
        }}
      >
        {children}
      </body>
    </html>
  );
}
