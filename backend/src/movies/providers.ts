import fetch from 'node-fetch';
import { MovieIdentifier, MovieMetadataProviderName } from './types';

export interface MovieCollectionMetadata {
  externalIds: Record<string, string>;
  name: string;
  overview?: string | null;
  imageUrl?: string | null;
}

export interface MovieGenreMetadata {
  externalIds: Record<string, string>;
  name: string;
}

export interface MovieCastMember {
  name: string;
  character?: string | null;
  order?: number | null;
  externalIds?: Record<string, string>;
}

export interface MovieCrewMember {
  name: string;
  job?: string | null;
  department?: string | null;
  externalIds?: Record<string, string>;
}

export interface MovieProviderMetadata {
  providerId?: string | null;
  name: string;
  type: string;
  region?: string | null;
  link?: string | null;
  metadata?: Record<string, any>;
}

export interface MovieMetadata {
  externalIds: Record<string, string | undefined>;
  title: string;
  overview?: string | null;
  status?: string | null;
  releaseDate?: string | null;
  runtimeMinutes?: number | null;
  rating?: number | null;
  language?: string | null;
  imageUrl?: string | null;
  collection?: MovieCollectionMetadata | null;
  genres?: MovieGenreMetadata[];
  cast?: MovieCastMember[];
  crew?: MovieCrewMember[];
  providers?: MovieProviderMetadata[];
}

export interface MovieMetadataProvider {
  name: MovieMetadataProviderName;
  fetchMovie(identifier: MovieIdentifier, region?: string): Promise<MovieMetadata | null>;
}

export class TMDBProvider implements MovieMetadataProvider {
  name: MovieMetadataProviderName = 'tmdb';
  private apiKey?: string;
  private baseUrl: string;
  private imageBaseUrl: string;

  constructor() {
    this.apiKey = process.env.MOVIE_TMDB_API_KEY || process.env.TMDB_API_KEY;
    this.baseUrl = process.env.MOVIE_TMDB_BASE_URL || 'https://api.themoviedb.org/3';
    this.imageBaseUrl = process.env.MOVIE_TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p/original';
  }

  async fetchMovie(identifier: MovieIdentifier, region?: string): Promise<MovieMetadata | null> {
    if (!this.apiKey) return null;

    let movieId = identifier.tmdbId;

    if (!movieId && identifier.imdbId) {
      const find = await this.fetchJson(`/find/${identifier.imdbId}`, { external_source: 'imdb_id' });
      movieId = find?.movie_results?.[0]?.id ? String(find.movie_results[0].id) : undefined;
    }

    if (!movieId && identifier.title) {
      const search = await this.fetchJson('/search/movie', {
        query: identifier.title,
        year: identifier.year
      });
      movieId = search?.results?.[0]?.id ? String(search.results[0].id) : undefined;
    }

    if (!movieId) return null;

    const movie = await this.fetchJson(`/movie/${movieId}`, {
      append_to_response: 'credits,watch/providers'
    });
    if (!movie) return null;

    const collection = movie.belongs_to_collection
      ? await this.fetchCollection(movie.belongs_to_collection.id)
      : null;

    const providers = this.extractProviders(movie, region || process.env.MOVIE_PROVIDER_REGION || 'US');

    return {
      externalIds: {
        tmdb: String(movie.id),
        imdb: movie.imdb_id ? String(movie.imdb_id) : undefined
      },
      title: movie.title,
      overview: movie.overview || null,
      status: movie.status || null,
      releaseDate: movie.release_date || null,
      runtimeMinutes: movie.runtime || null,
      rating: movie.vote_average || null,
      language: movie.original_language || null,
      imageUrl: movie.poster_path ? `${this.imageBaseUrl}${movie.poster_path}` : null,
      collection,
      genres: (movie.genres || []).map((g: any) => ({
        name: g.name,
        externalIds: { tmdb: String(g.id) }
      })),
      cast: (movie.credits?.cast || []).map((member: any) => ({
        name: member.name,
        character: member.character || null,
        order: member.order ?? null,
        externalIds: { tmdb: String(member.id) }
      })),
      crew: (movie.credits?.crew || []).map((member: any) => ({
        name: member.name,
        job: member.job || null,
        department: member.department || null,
        externalIds: { tmdb: String(member.id) }
      })),
      providers
    };
  }

  private async fetchCollection(collectionId: string): Promise<MovieCollectionMetadata | null> {
    const collection = await this.fetchJson(`/collection/${collectionId}`);
    if (!collection) return null;

    return {
      externalIds: { tmdb: String(collection.id) },
      name: collection.name,
      overview: collection.overview || null,
      imageUrl: collection.poster_path ? `${this.imageBaseUrl}${collection.poster_path}` : null
    };
  }

  private extractProviders(movie: any, region: string): MovieProviderMetadata[] {
    const providers = movie?.['watch/providers']?.results?.[region];
    if (!providers) return [];
    const link = providers.link || null;

    const collect = (items: any[] | undefined, type: string) =>
      (items || []).map(item => ({
        providerId: item.provider_id ? String(item.provider_id) : null,
        name: item.provider_name,
        type,
        region,
        link,
        metadata: {
          displayPriority: item.display_priority ?? null,
          logoPath: item.logo_path ? `${this.imageBaseUrl}${item.logo_path}` : null
        }
      }));

    return [
      ...collect(providers.flatrate, 'flatrate'),
      ...collect(providers.rent, 'rent'),
      ...collect(providers.buy, 'buy')
    ];
  }

  private async fetchJson(path: string, params?: Record<string, any>) {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set('api_key', this.apiKey || '');
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') continue;
        url.searchParams.set(key, String(value));
      }
    }
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    return await response.json();
  }
}

export class OMDBProvider implements MovieMetadataProvider {
  name: MovieMetadataProviderName = 'omdb';
  private apiKey?: string;

  constructor() {
    this.apiKey = process.env.MOVIE_OMDB_API_KEY || process.env.OMDB_API_KEY;
  }

  async fetchMovie(identifier: MovieIdentifier, _region?: string): Promise<MovieMetadata | null> {
    if (!this.apiKey) return null;

    const params: Record<string, string> = { apikey: this.apiKey };
    if (identifier.imdbId) {
      params.i = identifier.imdbId;
    } else if (identifier.title) {
      params.t = identifier.title;
      if (identifier.year) params.y = String(identifier.year);
    } else {
      return null;
    }

    const url = new URL('https://www.omdbapi.com/');
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

    const response = await fetch(url.toString());
    if (!response.ok) return null;
    const payload = await response.json();
    if (payload.Response === 'False') return null;

    const genres = (payload.Genre || '')
      .split(',')
      .map((g: string) => g.trim())
      .filter(Boolean)
      .map((name: string) => ({ name, externalIds: { omdb: name.toLowerCase() } }));

    const cast = (payload.Actors || '')
      .split(',')
      .map((name: string, idx: number) => ({ name: name.trim(), order: idx }));

    const crew: MovieCrewMember[] = [];
    if (payload.Director) {
      payload.Director.split(',').forEach((name: string) => {
        crew.push({ name: name.trim(), job: 'Director', department: 'Directing' });
      });
    }
    if (payload.Writer) {
      payload.Writer.split(',').forEach((name: string) => {
        crew.push({ name: name.trim(), job: 'Writer', department: 'Writing' });
      });
    }

    const runtimeMinutes = payload.Runtime ? parseInt(payload.Runtime.replace(' min', '').trim(), 10) : null;
    const rating = payload.imdbRating ? parseFloat(payload.imdbRating) : null;

    return {
      externalIds: {
        imdb: payload.imdbID ? String(payload.imdbID) : undefined
      },
      title: payload.Title,
      overview: payload.Plot || null,
      status: payload.Released || null,
      releaseDate: payload.Released ? new Date(payload.Released).toISOString().slice(0, 10) : null,
      runtimeMinutes: isNaN(runtimeMinutes as any) ? null : runtimeMinutes,
      rating: isNaN(rating as any) ? null : rating,
      language: payload.Language ? payload.Language.split(',')[0].trim() : null,
      imageUrl: payload.Poster && payload.Poster !== 'N/A' ? payload.Poster : null,
      collection: null,
      genres,
      cast,
      crew,
      providers: []
    };
  }
}
