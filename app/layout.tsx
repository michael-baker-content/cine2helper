import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cine2Nerdle Battle — Cheat Sheet',
  description: 'A strategic cheat sheet for Cine2Nerdle Battle. Browse movies that satisfy every season win condition, powered by TMDB.',
  keywords: ['cine2nerdle', 'cinenerdle', 'battle', 'cheat sheet', 'movie trivia', 'win conditions'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
