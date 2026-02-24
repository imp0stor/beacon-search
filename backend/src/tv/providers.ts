import fetch from 'node-fetch';
import { TVMetadataProviderName, TVSeriesIdentifier } from './types';

export interface TVSeriesMetadata {
  externalIds: Record<string, string>;
  title: string;
  overview?: string | null;
  status?: string | null;
  network?: string | null;
  genres?: string[];
  language?: string | null;
  firstAirDate?: string | null;
  lastAirDate?: string | null;
  imageUrl?: string | null;
}

export interface TVSeasonMetadata {
  seasonNumber: number;
  title?: string | null;
  overview?: string | null;
  airDate?: string | null;
  episodeCount?: number | null;
  imageUrl?: string | null;
}

export interface TVEpisodeMetadata {
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  overview?: string | null;
  airDate?: string | null;
  runtimeMinutes?: number | null;
  rating?: number | null;
  imageUrl?: string | null;
  externalIds?: Record<string, string>;
  cast?: string[];
}

export interface TVMetadataProvider {
  name: TVMetadataProviderName;
  fetchSeries(identifier: TVSeriesIdentifier): Promise<TVSeriesMetadata | null>;
  fetchSeasons(series: TVSeriesMetadata): Promise<TVSeasonMetadata[]>;
  fetchEpisodes(series: TVSeriesMetadata): Promise<TVEpisodeMetadata[]>;
}

export class TVMazeProvider implements TVMetadataProvider {
  name: TVMetadataProviderName = 'tvmaze';

  async fetchSeries(identifier: TVSeriesIdentifier): Promise<TVSeriesMetadata | null> {
    if (identifier.tvmazeId) {
      const show = await this.fetchJson(`https://api.tvmaze.com/shows/${identifier.tvmazeId}`);
      return this.mapSeries(show);
    }

    if (!identifier.title) return null;
    const query = encodeURIComponent(identifier.title);
    const show = await this.fetchJson(`https://api.tvmaze.com/singlesearch/shows?q=${query}`);
    return show ? this.mapSeries(show) : null;
  }

  async fetchSeasons(series: TVSeriesMetadata): Promise<TVSeasonMetadata[]> {
    const tvmazeId = series.externalIds.tvmaze;
    if (!tvmazeId) return [];
    const seasons = await this.fetchJson(`https://api.tvmaze.com/shows/${tvmazeId}/seasons`);
    return (seasons || []).map((season: any) => ({
      seasonNumber: season.number,
      title: season.name || `Season ${season.number}`,
      overview: season.summary ? stripHtml(season.summary) : null,
      airDate: season.premiereDate || null,
      episodeCount: season.episodeOrder || null,
      imageUrl: season.image?.original || season.image?.medium || null
    }));
  }

  async fetchEpisodes(series: TVSeriesMetadata): Promise<TVEpisodeMetadata[]> {
    const tvmazeId = series.externalIds.tvmaze;
    if (!tvmazeId) return [];
    const episodes = await this.fetchJson(`https://api.tvmaze.com/shows/${tvmazeId}/episodes`);
    return (episodes || []).map((ep: any) => ({
      seasonNumber: ep.season,
      episodeNumber: ep.number,
      title: ep.name || `Episode ${ep.number}`,
      overview: ep.summary ? stripHtml(ep.summary) : null,
      airDate: ep.airdate || null,
      runtimeMinutes: ep.runtime || null,
      rating: ep.rating?.average || null,
      imageUrl: ep.image?.original || ep.image?.medium || null,
      externalIds: ep.externals || { tvmaze: String(ep.id) },
      cast: []
    }));
  }

  private mapSeries(show: any): TVSeriesMetadata | null {
    if (!show) return null;
    return {
      externalIds: { tvmaze: String(show.id), ...(show.externals || {}) },
      title: show.name,
      overview: show.summary ? stripHtml(show.summary) : null,
      status: show.status || null,
      network: show.network?.name || show.webChannel?.name || null,
      genres: show.genres || [],
      language: show.language || null,
      firstAirDate: show.premiered || null,
      lastAirDate: show.ended || null,
      imageUrl: show.image?.original || show.image?.medium || null
    };
  }

  private async fetchJson(url: string) {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  }
}

export class TVDBProvider implements TVMetadataProvider {
  name: TVMetadataProviderName = 'tvdb';
  private token: string | null = null;
  private baseUrl: string;
  private apiKey: string | undefined;
  private pin?: string;

  constructor() {
    this.baseUrl = process.env.TVDB_BASE_URL || 'https://api4.thetvdb.com/v4';
    this.apiKey = process.env.TVDB_API_KEY;
    this.pin = process.env.TVDB_PIN;
  }

  async fetchSeries(identifier: TVSeriesIdentifier): Promise<TVSeriesMetadata | null> {
    if (!this.apiKey) return null;
    if (!identifier.tvdbId && !identifier.title) return null;

    await this.ensureToken();

    if (identifier.tvdbId) {
      const series = await this.fetchJson(`${this.baseUrl}/series/${identifier.tvdbId}/extended`);
      return series ? this.mapSeries(series.data) : null;
    }

    const search = await this.fetchJson(`${this.baseUrl}/search?query=${encodeURIComponent(identifier.title || '')}`);
    const match = search?.data?.[0];
    if (!match?.tvdb_id) return null;
    const series = await this.fetchJson(`${this.baseUrl}/series/${match.tvdb_id}/extended`);
    return series ? this.mapSeries(series.data) : null;
  }

  async fetchSeasons(series: TVSeriesMetadata): Promise<TVSeasonMetadata[]> {
    if (!this.apiKey || !series.externalIds.tvdb) return [];
    await this.ensureToken();
    const result = await this.fetchJson(`${this.baseUrl}/series/${series.externalIds.tvdb}/extended`);
    const seasons = result?.data?.seasons || [];
    return seasons.map((season: any) => ({
      seasonNumber: season.number,
      title: season.name || `Season ${season.number}`,
      overview: season.overview || null,
      airDate: season.air_date || null,
      episodeCount: season.episode_count || null,
      imageUrl: season.image || null
    }));
  }

  async fetchEpisodes(series: TVSeriesMetadata): Promise<TVEpisodeMetadata[]> {
    if (!this.apiKey || !series.externalIds.tvdb) return [];
    await this.ensureToken();

    const episodes: TVEpisodeMetadata[] = [];
    let page = 0;
    let totalPages = 1;

    while (page < totalPages && page < 5) {
      const result = await this.fetchJson(`${this.baseUrl}/series/${series.externalIds.tvdb}/episodes/default?page=${page}`);
      const data = result?.data || [];
      totalPages = result?.links?.last ?? totalPages;
      for (const ep of data) {
        episodes.push({
          seasonNumber: ep.seasonNumber,
          episodeNumber: ep.number,
          title: ep.name || `Episode ${ep.number}`,
          overview: ep.overview || null,
          airDate: ep.airDate || null,
          runtimeMinutes: ep.runtime || null,
          rating: ep.rating || null,
          imageUrl: ep.image || null,
          externalIds: { tvdb: String(ep.id) },
          cast: []
        });
      }
      page += 1;
    }

    return episodes;
  }

  private async ensureToken() {
    if (this.token || !this.apiKey) return;
    const response = await fetch(`${this.baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apikey: this.apiKey, pin: this.pin })
    });
    if (!response.ok) {
      throw new Error(`TVDB login failed: ${response.status}`);
    }
    const payload = await response.json();
    this.token = payload?.data?.token;
  }

  private async fetchJson(url: string) {
    if (!this.token) return null;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`
      }
    });
    if (!response.ok) return null;
    return await response.json();
  }

  private mapSeries(series: any): TVSeriesMetadata | null {
    if (!series) return null;
    return {
      externalIds: { tvdb: String(series.id) },
      title: series.name,
      overview: series.overview || null,
      status: series.status?.name || series.status || null,
      network: series.networks?.[0]?.name || null,
      genres: (series.genres || []).map((g: any) => g.name || g),
      language: series.original_language || null,
      firstAirDate: series.firstAired || null,
      lastAirDate: series.lastAired || null,
      imageUrl: series.image || null
    };
  }
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
