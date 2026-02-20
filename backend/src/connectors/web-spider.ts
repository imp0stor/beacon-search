/**
 * Web Spider Connector
 * Crawls websites starting from a seed URL
 */

import { BaseConnector } from './base';
import { Connector, WebConnectorConfig, ExtractedDocument } from './types';
import * as cheerio from 'cheerio';

interface RobotsTxt {
  disallowed: string[];
  crawlDelay?: number;
}

interface QueueItem {
  url: string;
  depth: number;
}

export class WebSpiderConnector extends BaseConnector {
  private config: WebConnectorConfig;
  private visited: Set<string> = new Set();
  private queue: QueueItem[] = [];
  private robotsTxt: RobotsTxt | null = null;
  private baseDomain: string = '';

  constructor(connector: Connector) {
    super(connector);
    this.config = connector.config as WebConnectorConfig;
  }

  protected async execute(): Promise<void> {
    const seedUrl = new URL(this.config.seedUrl);
    this.baseDomain = seedUrl.hostname;

    this.log(`Starting spider at: ${this.config.seedUrl}`);
    this.log(`Max depth: ${this.config.maxDepth}, Max pages: ${this.config.maxPages}`);
    this.log(`Same domain only: ${this.config.sameDomainOnly}`);

    if (this.config.respectRobotsTxt) {
      await this.fetchRobotsTxt(seedUrl.origin);
    }

    this.queue.push({ url: this.config.seedUrl, depth: 0 });
    this.visited.clear();

    let processedCount = 0;

    while (this.queue.length > 0 && this.shouldContinue()) {
      if (processedCount >= this.config.maxPages) {
        this.log(`Reached max pages limit: ${this.config.maxPages}`);
        break;
      }

      const item = this.queue.shift()!;
      
      if (this.visited.has(item.url)) {
        continue;
      }

      if (this.robotsTxt && this.isDisallowed(item.url)) {
        this.log(`Skipping (robots.txt): ${item.url}`);
        continue;
      }

      this.visited.add(item.url);
      processedCount++;

      this.updateProgress(
        processedCount,
        Math.min(this.config.maxPages, processedCount + this.queue.length),
        item.url
      );

      try {
        await this.processUrl(item.url, item.depth);
      } catch (error) {
        this.log(`Error processing ${item.url}: ${error instanceof Error ? error.message : String(error)}`);
      }

      if (this.queue.length > 0 && this.shouldContinue()) {
        const delay = this.robotsTxt?.crawlDelay 
          ? this.robotsTxt.crawlDelay * 1000 
          : this.config.rateLimit;
        await this.sleep(delay);
      }
    }

    this.log(`Spider complete. Processed ${processedCount} pages.`);
  }

  private async fetchRobotsTxt(origin: string): Promise<void> {
    try {
      const robotsUrl = `${origin}/robots.txt`;
      this.log(`Fetching robots.txt from: ${robotsUrl}`);

      const response = await fetch(robotsUrl, {
        headers: { 'User-Agent': 'BeaconSearchBot/1.0' }
      });

      if (!response.ok) {
        this.log('No robots.txt found or inaccessible');
        return;
      }

      const text = await response.text();
      this.robotsTxt = this.parseRobotsTxt(text);
      
      this.log(`Robots.txt parsed: ${this.robotsTxt.disallowed.length} disallowed paths`);
      if (this.robotsTxt.crawlDelay) {
        this.log(`Crawl-delay: ${this.robotsTxt.crawlDelay}s`);
      }
    } catch (error) {
      this.log(`Failed to fetch robots.txt: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private parseRobotsTxt(text: string): RobotsTxt {
    const result: RobotsTxt = { disallowed: [] };
    let inUserAgentBlock = false;

    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();
      
      if (trimmed.startsWith('user-agent:')) {
        const agent = trimmed.substring('user-agent:'.length).trim();
        inUserAgentBlock = agent === '*' || agent.includes('beaconsearchbot');
      } else if (inUserAgentBlock) {
        if (trimmed.startsWith('disallow:')) {
          const path = line.substring(line.indexOf(':') + 1).trim();
          if (path) {
            result.disallowed.push(path);
          }
        } else if (trimmed.startsWith('crawl-delay:')) {
          const delay = parseFloat(trimmed.substring('crawl-delay:'.length).trim());
          if (!isNaN(delay)) {
            result.crawlDelay = delay;
          }
        }
      }
    }

    return result;
  }

  private isDisallowed(urlStr: string): boolean {
    if (!this.robotsTxt) return false;

    try {
      const url = new URL(urlStr);
      const path = url.pathname;

      for (const disallowed of this.robotsTxt.disallowed) {
        if (disallowed === '/') return true;
        if (path.startsWith(disallowed)) return true;
        if (disallowed.includes('*')) {
          const regex = new RegExp('^' + disallowed.replace(/\*/g, '.*'));
          if (regex.test(path)) return true;
        }
      }
    } catch {
      return false;
    }

    return false;
  }

  private async processUrl(urlStr: string, depth: number): Promise<void> {
    this.log(`Processing [depth=${depth}]: ${urlStr}`);

    const response = await fetch(urlStr, {
      headers: {
        'User-Agent': 'BeaconSearchBot/1.0 (+https://github.com/beacon-search)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      this.log(`Skipping non-HTML content: ${contentType}`);
      return;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = this.extractTitle($);
    const content = this.extractContent($);
    const finalUrl = response.url;

    if (!content || content.length < 50) {
      this.log(`Skipping page with insufficient content: ${urlStr}`);
      return;
    }

    const doc: ExtractedDocument = {
      externalId: this.urlToId(finalUrl),
      title: title || this.extractTitleFromUrl(finalUrl),
      content,
      url: finalUrl,
      attributes: {
        crawlDepth: depth,
        contentLength: content.length,
        crawledAt: new Date().toISOString()
      },
      lastModified: new Date()
    };

    this.emitDocument(doc);

    if (depth < this.config.maxDepth) {
      const links = this.extractLinks($, finalUrl);
      
      for (const link of links) {
        if (this.shouldQueueLink(link)) {
          this.queue.push({ url: link, depth: depth + 1 });
        }
      }
    }
  }

  private extractTitle($: cheerio.CheerioAPI): string {
    const ogTitle = $('meta[property="og:title"]').attr('content');
    if (ogTitle) return ogTitle.trim();

    const titleTag = $('title').text();
    if (titleTag) return titleTag.trim();

    const h1 = $('h1').first().text();
    if (h1) return h1.trim();

    return '';
  }

  private extractContent($: cheerio.CheerioAPI): string {
    $('script, style, nav, header, footer, aside, noscript, iframe, form').remove();
    $('[role="navigation"], [role="banner"], [role="contentinfo"]').remove();
    $('.nav, .menu, .sidebar, .footer, .header, .advertisement, .ads').remove();

    let content = '';

    const contentSelectors = [
      'article', '[role="main"]', 'main', '.content',
      '.post-content', '.article-content', '.entry-content',
      '#content', '.main-content'
    ];

    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length) {
        content = element.text();
        break;
      }
    }

    if (!content) {
      content = $('body').text();
    }

    content = content.replace(/\s+/g, ' ').replace(/\n+/g, '\n').trim();

    if (content.length > 50000) {
      content = content.substring(0, 50000) + '...';
    }

    return content;
  }

  private extractLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
    const links: string[] = [];

    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (!href) return;

      try {
        const absoluteUrl = new URL(href, baseUrl);
        if (!['http:', 'https:'].includes(absoluteUrl.protocol)) return;
        absoluteUrl.hash = '';
        const normalizedUrl = absoluteUrl.href;
        if (!links.includes(normalizedUrl)) {
          links.push(normalizedUrl);
        }
      } catch {
        // Invalid URL, skip
      }
    });

    return links;
  }

  private shouldQueueLink(urlStr: string): boolean {
    if (this.visited.has(urlStr)) return false;
    if (this.queue.some(item => item.url === urlStr)) return false;

    try {
      const url = new URL(urlStr);

      if (this.config.sameDomainOnly && url.hostname !== this.baseDomain) {
        return false;
      }

      const skipPaths = ['/login', '/logout', '/signin', '/signout', '/register', '/admin', '/wp-admin'];
      if (skipPaths.some((p: string) => url.pathname.startsWith(p))) {
        return false;
      }

      const skipExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.zip', '.exe', '.dmg', '.mp3', '.mp4'];
      if (skipExtensions.some((ext: string) => url.pathname.toLowerCase().endsWith(ext))) {
        return false;
      }

      if (this.config.includePatterns && this.config.includePatterns.length > 0) {
        const matches = this.config.includePatterns.some(pattern => {
          const regex = new RegExp(pattern);
          return regex.test(urlStr);
        });
        if (!matches) return false;
      }

      if (this.config.excludePatterns && this.config.excludePatterns.length > 0) {
        const excluded = this.config.excludePatterns.some(pattern => {
          const regex = new RegExp(pattern);
          return regex.test(urlStr);
        });
        if (excluded) return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private urlToId(url: string): string {
    return Buffer.from(url).toString('base64url').substring(0, 64);
  }

  private extractTitleFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname;
      const segments = path.split('/').filter(s => s);
      if (segments.length > 0) {
        let title = segments[segments.length - 1];
        title = title.replace(/\.[^/.]+$/, '');
        title = title.replace(/[-_]/g, ' ');
        return title.charAt(0).toUpperCase() + title.slice(1);
      }
      return parsed.hostname;
    } catch {
      return 'Untitled';
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
