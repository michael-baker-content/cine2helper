import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cine2Helper',
  description: 'A companion tool for Cine2Nerdle Battle. Browse films by win condition and find overlaps to identify your strongest plays.',
  keywords: ['cine2nerdle', 'cinenerdle', 'battle', 'win conditions', 'movie trivia', 'cine2helper'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
