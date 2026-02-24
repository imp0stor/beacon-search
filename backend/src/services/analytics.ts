/**
 * Analytics Service
 * Provides analytics calculations and aggregations for authors and content
 * 
 * Created: 2026-02-20 (P2 Features)
 */

import { Pool } from 'pg';

export interface AuthorStats {
  pubkey: string;
  name?: string;
  picture?: string;
  nip05?: string;
  totalZapsEarned: number;
  totalDocuments: number;
  totalEngagement: number;
  averageZapPerDocument: number;
  followerCount?: number;
}

export interface ContentStats {
  type: string;
  count: number;
  zapsEarned: number;
  averagePerItem: number;
}

export interface ZapTrend {
  lastWeekZaps: number;
  trendDirection: 'up' | 'down' | 'flat';
  trendPercent: number;
}

export interface DocumentHeatmap {
  documentId: string;
  title: string;
  totalZaps: number;
  totalSats: number;
  paragraphs: ParagraphHeatmap[];
  hotspots: Hotspot[];
  peakParagraph: ParagraphHeatmap | null;
}

export interface ParagraphHeatmap {
  index: number;
  text?: string;  // Optional: include first 100 chars for context
  zapCount: number;
  totalSats: number;
  percentageOfTotal: number;
}

export interface Hotspot {
  paragraphIndex: number;
  percentageOfTotal: number;
  heat: 'cold' | 'warm' | 'hot' | 'burning';
}

export interface RecentActivity {
  timestamp: Date;
  action: 'zap' | 'view' | 'share';
  amount?: number;
  documentId?: string;
  documentTitle?: string;
}

export class AnalyticsService {
  constructor(private pool: Pool) {}

  /**
   * Get comprehensive author analytics
   */
  async getAuthorAnalytics(
    authorPubkey: string,
    timeframe: 'all' | 'month' | 'week' | 'day' = 'all'
  ): Promise<{
    stats: AuthorStats;
    contentBreakdown: ContentStats[];
    recentActivity: RecentActivity[];
    trends: ZapTrend;
  }> {
    // Get author profile
    const authorQuery = `
      SELECT id, display_name as name, picture, nip05
      FROM documents
      WHERE author_pubkey = $1
      LIMIT 1
    `;
    const authorResult = await this.pool.query(authorQuery, [authorPubkey]);

    // Get analytics stats
    const statsQuery = `
      SELECT 
        author_pubkey,
        total_zaps_earned,
        total_documents,
        total_engagement,
        CASE 
          WHEN total_documents > 0 THEN ROUND(total_zaps_earned::float / total_documents)
          ELSE 0
        END as avg_zaps_per_document
      FROM author_analytics
      WHERE author_pubkey = $1
    `;
    const statsResult = await this.pool.query(statsQuery, [authorPubkey]);

    if (statsResult.rows.length === 0) {
      // No stats yet, return zeros
      return {
        stats: {
          pubkey: authorPubkey,
          totalZapsEarned: 0,
          totalDocuments: 0,
          totalEngagement: 0,
          averageZapPerDocument: 0
        },
        contentBreakdown: [],
        recentActivity: [],
        trends: {
          lastWeekZaps: 0,
          trendDirection: 'flat',
          trendPercent: 0
        }
      };
    }

    const stats = statsResult.rows[0];
    const authorProfile = authorResult.rows[0];

    // Get content breakdown by type
    const contentQuery = `
      SELECT 
        document_type,
        COUNT(*) as count,
        SUM(COALESCE(zaps_earned, 0)) as zaps_earned,
        ROUND(AVG(COALESCE(zaps_earned, 0))) as avg_per_item
      FROM documents
      WHERE author_pubkey = $1
      GROUP BY document_type
      ORDER BY zaps_earned DESC
    `;
    const contentResult = await this.pool.query(contentQuery, [authorPubkey]);

    const contentBreakdown: ContentStats[] = contentResult.rows.map((row: any) => ({
      type: row.document_type || 'other',
      count: row.count || 0,
      zapsEarned: row.zaps_earned || 0,
      averagePerItem: row.avg_per_item || 0
    }));

    // Get recent activity
    const activityQuery = `
      SELECT 
        timestamp,
        'zap' as action,
        amount_sats as amount,
        document_id,
        NULL as document_title
      FROM zap_engagement
      WHERE author_pubkey = $1
      ORDER BY timestamp DESC
      LIMIT 20
    `;
    const activityResult = await this.pool.query(activityQuery, [authorPubkey]);

    const recentActivity: RecentActivity[] = activityResult.rows.map((row: any) => ({
      timestamp: row.timestamp,
      action: row.action as 'zap' | 'view' | 'share',
      amount: row.amount,
      documentId: row.document_id
    }));

    // Get zap trends
    const trendsQuery = `
      SELECT 
        COUNT(*) as count,
        SUM(amount_sats) as total_sats
      FROM zap_engagement
      WHERE author_pubkey = $1
      AND timestamp > NOW() - INTERVAL '7 days'
    `;
    const trendsResult = await this.pool.query(trendsQuery, [authorPubkey]);

    const lastWeekZaps = trendsResult.rows[0]?.total_sats || 0;

    // Calculate trend (this week vs last week)
    const lastLastWeekQuery = `
      SELECT SUM(amount_sats) as total_sats
      FROM zap_engagement
      WHERE author_pubkey = $1
      AND timestamp > NOW() - INTERVAL '14 days'
      AND timestamp <= NOW() - INTERVAL '7 days'
    `;
    const lastLastWeekResult = await this.pool.query(lastLastWeekQuery, [authorPubkey]);
    const lastLastWeekZaps = lastLastWeekResult.rows[0]?.total_sats || 0;

    const trendPercent =
      lastLastWeekZaps === 0
        ? lastWeekZaps > 0
          ? 100
          : 0
        : Math.round(((lastWeekZaps - lastLastWeekZaps) / lastLastWeekZaps) * 100 * 10) / 10;

    const trendDirection =
      trendPercent > 5 ? 'up' : trendPercent < -5 ? 'down' : 'flat';

    return {
      stats: {
        pubkey: authorPubkey,
        name: authorProfile?.name,
        picture: authorProfile?.picture,
        nip05: authorProfile?.nip05,
        totalZapsEarned: stats.total_zaps_earned,
        totalDocuments: stats.total_documents,
        totalEngagement: stats.total_engagement,
        averageZapPerDocument: stats.avg_zaps_per_document
      },
      contentBreakdown,
      recentActivity,
      trends: {
        lastWeekZaps,
        trendDirection,
        trendPercent
      }
    };
  }

  /**
   * Get zap heatmap for a specific document
   */
  async getDocumentHeatmap(documentId: string): Promise<DocumentHeatmap> {
    // Get document info
    const docQuery = `
      SELECT id, title, author_pubkey
      FROM documents
      WHERE id = $1
    `;
    const docResult = await this.pool.query(docQuery, [documentId]);

    if (docResult.rows.length === 0) {
      throw new Error(`Document not found: ${documentId}`);
    }

    const doc = docResult.rows[0];

    // Get heatmap data
    const heatmapQuery = `
      SELECT 
        paragraph_index,
        zap_count,
        total_sats
      FROM zap_heatmap
      WHERE document_id = $1
      ORDER BY paragraph_index ASC
    `;
    const heatmapResult = await this.pool.query(heatmapQuery, [documentId]);

    // Get total zaps
    const totalQuery = `
      SELECT 
        COUNT(*) as total_zaps,
        SUM(total_sats) as total_sats
      FROM zap_heatmap
      WHERE document_id = $1
    `;
    const totalResult = await this.pool.query(totalQuery, [documentId]);
    const totalZaps = totalResult.rows[0]?.total_zaps || 0;
    const totalSats = totalResult.rows[0]?.total_sats || 0;

    // Calculate percentages and identify hotspots
    const paragraphs: ParagraphHeatmap[] = heatmapResult.rows.map((row: any) => {
      const percentageOfTotal = totalSats > 0 ? (row.total_sats / totalSats) * 100 : 0;
      return {
        index: row.paragraph_index,
        zapCount: row.zap_count || 0,
        totalSats: row.total_sats || 0,
        percentageOfTotal: Math.round(percentageOfTotal * 10) / 10
      };
    });

    const hotspots: Hotspot[] = paragraphs
      .filter(p => p.percentageOfTotal > 0)
      .map(p => {
        let heat: 'cold' | 'warm' | 'hot' | 'burning' = 'cold';
        if (p.percentageOfTotal >= 40) heat = 'burning';
        else if (p.percentageOfTotal >= 20) heat = 'hot';
        else if (p.percentageOfTotal >= 10) heat = 'warm';

        return {
          paragraphIndex: p.index,
          percentageOfTotal: p.percentageOfTotal,
          heat
        };
      })
      .sort((a, b) => b.percentageOfTotal - a.percentageOfTotal)
      .slice(0, 10);  // Top 10 hotspots

    const peakParagraph = paragraphs.length > 0
      ? paragraphs.reduce((max, p) => (p.totalSats > max.totalSats ? p : max))
      : null;

    return {
      documentId,
      title: doc.title,
      totalZaps,
      totalSats,
      paragraphs,
      hotspots,
      peakParagraph
    };
  }

  /**
   * Record a zap engagement event
   */
  async recordZapEngagement(
    documentId: string,
    authorPubkey: string,
    zapperPubkey: string | null,
    amountSats: number,
    paragraphIndex?: number,
    nostrEventId?: string
  ): Promise<void> {
    const query = `
      SELECT record_zap_engagement($1, $2, $3, $4, $5, $6)
    `;
    await this.pool.query(query, [
      documentId,
      authorPubkey,
      zapperPubkey,
      amountSats,
      paragraphIndex ?? null,
      nostrEventId ?? null
    ]);
  }

  /**
   * Get trending documents by zaps in timeframe
   */
  async getTrendingDocuments(
    timeframe: 'day' | 'week' | 'month' = 'week',
    limit = 10
  ): Promise<{
    documentId: string;
    title: string;
    authorPubkey: string;
    zapsEarned: number;
    zapCount: number;
  }[]> {
    const intervalMap = {
      day: "INTERVAL '1 day'",
      week: "INTERVAL '7 days'",
      month: "INTERVAL '30 days'"
    };

    const query = `
      SELECT 
        d.id as document_id,
        d.title,
        d.author_pubkey,
        COALESCE(SUM(ze.amount_sats), 0) as zaps_earned,
        COALESCE(COUNT(*), 0) as zap_count
      FROM documents d
      LEFT JOIN zap_engagement ze ON d.id = ze.document_id
        AND ze.timestamp > NOW() - ${intervalMap[timeframe]}
      GROUP BY d.id, d.title, d.author_pubkey
      HAVING COALESCE(SUM(ze.amount_sats), 0) > 0
      ORDER BY zaps_earned DESC
      LIMIT $1
    `;
    const result = await this.pool.query(query, [limit]);
    return result.rows;
  }

  /**
   * Get authors by total earnings
   */
  async getTopAuthors(limit = 10): Promise<AuthorStats[]> {
    const query = `
      SELECT 
        aa.author_pubkey,
        aa.total_zaps_earned,
        aa.total_documents,
        aa.total_engagement,
        CASE 
          WHEN aa.total_documents > 0 THEN ROUND(aa.total_zaps_earned::float / aa.total_documents)
          ELSE 0
        END as avg_zaps_per_document,
        d.display_name as name,
        d.picture,
        d.nip05
      FROM author_analytics aa
      LEFT JOIN documents d ON d.author_pubkey = aa.author_pubkey
      ORDER BY aa.total_zaps_earned DESC
      LIMIT $1
    `;
    const result = await this.pool.query(query, [limit]);
    return result.rows.map(row => ({
      pubkey: row.author_pubkey,
      name: row.name,
      picture: row.picture,
      nip05: row.nip05,
      totalZapsEarned: row.total_zaps_earned,
      totalDocuments: row.total_documents,
      totalEngagement: row.total_engagement,
      averageZapPerDocument: row.avg_zaps_per_document
    }));
  }
}
