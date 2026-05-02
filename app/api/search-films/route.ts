import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const token = process.env.TMDB_READ_ACCESS_TOKEN;
    const url = new URL('https://api.themoviedb.org/3/search/movie');
    url.searchParams.set('query', query.trim());
    url.searchParams.set('language', 'en-US');
    url.searchParams.set('include_adult', 'false');

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 300 }, // cache search results for 5 minutes
    });

    if (!res.ok) throw new Error(`TMDB search error ${res.status}`);

    const data = await res.json();

    // Filter to films with a release date and exclude documentaries (genre 99)
    const results = (data.results ?? [])
      .filter((f: any) =>
        f.release_date &&
        !(f.genre_ids ?? []).includes(99)
      )
      .slice(0, 8)
      .map((f: any) => ({
        id:           f.id,
        title:        f.title,
        release_date: f.release_date,
        poster_path:  f.poster_path ?? null,
        vote_average: f.vote_average ?? 0,
      }));

    return NextResponse.json({ results });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
