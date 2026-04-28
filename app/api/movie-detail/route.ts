import { NextRequest, NextResponse } from 'next/server';
import { getMovieDetails } from '@/lib/tmdb';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id || isNaN(parseInt(id))) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    const movie = await getMovieDetails(parseInt(id));
    return NextResponse.json(movie);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch' },
      { status: 500 }
    );
  }
}
