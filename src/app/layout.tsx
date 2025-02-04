import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MoodMatch',
  description: 'A simple RAG-based music matching app',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
