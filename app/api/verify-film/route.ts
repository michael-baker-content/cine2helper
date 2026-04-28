/**
 * app/api/verify-film/route.ts
 *
 * Lightweight TMDB movie lookup used exclusively by the verification page.
 * Returns just the fields needed to confirm an ID is correct.
 *
 * GET /api/verify-film?id=872585
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'TMDB token not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/${id}?language=en-US`,
      {
        headers: { Authorization: `Bearer ${token}` },
        // Short cache — this is a dev/admin tool, not production traffic
        next: { revalidate: 3600 },
      }
    );

    if (res.status === 404) {
      return NextResponse.json({ id: null }, { status: 200 });
    }

    if (!res.ok) {
      return NextResponse.json({ error: `TMDB error ${res.status}` }, { status: 502 });
    }

    const data = await res.json();

    return NextResponse.json({
      id: data.id,
      title: data.title,
      release_date: data.release_date,
      poster_path: data.poster_path,
      imdb_id: data.imdb_id,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
