import { NextRequest, NextResponse } from 'next/server';
import { searchPerson } from '@/lib/tmdb';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
  }

  try {
    const people = await searchPerson(query);
    return NextResponse.json({ results: people.slice(0, 10) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
