/**
 * Folder/File Connector
 * Recursively scans local folders and extracts text content
 */

import { BaseConnector } from './base';
import { Connector, FolderConnectorConfig, ExtractedDocument } from './types';
import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';

// Dynamic imports for optional dependencies
let pdfParse: any = null;
let mammoth: any = null;
let chokidar: any = null;

async function loadPdfParse() {
  if (!pdfParse) {
    try {
      pdfParse = (await import('pdf-parse')).default;
    } catch {
      console.warn('pdf-parse not installed. PDF support disabled.');
    }
  }
  return pdfParse;
}

async function loadMammoth() {
  if (!mammoth) {
    try {
      mammoth = await import('mammoth');
    } catch {
      console.warn('mammoth not installed. DOCX support disabled.');
    }
  }
  return mammoth;
}

async function loadChokidar() {
  if (!chokidar) {
    try {
      chokidar = await import('chokidar');
    } catch {
      console.warn('chokidar not installed. File watching disabled.');
    }
  }
  return chokidar;
}

interface FileInfo {
  path: string;
  relativePath: string;
  size: number;
  modifiedTime: Date;
  extension: string;
}

export class FolderConnector extends BaseConnector {
  private config: FolderConnectorConfig;
  private watcher: any = null;
  private fileQueue: FileInfo[] = [];

  constructor(connector: Connector) {
    super(connector);
    this.config = connector.config as FolderConnectorConfig;
  }

  protected async execute(): Promise<void> {
    const folderPath = this.resolvePath(this.config.folderPath);

    if (!fs.existsSync(folderPath)) {
      throw new Error(`Folder does not exist: ${folderPath}`);
    }

    const stats = fs.statSync(folderPath);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${folderPath}`);
    }

    this.log(`Scanning folder: ${folderPath}`);
    this.log(`Recursive: ${this.config.recursive}`);
    this.log(`File types: ${this.config.fileTypes.join(', ')}`);

    this.fileQueue = [];
    await this.collectFiles(folderPath, folderPath);

    this.log(`Found ${this.fileQueue.length} files to process`);

    let processed = 0;
    for (const fileInfo of this.fileQueue) {
      if (!this.shouldContinue()) break;

      this.updateProgress(processed, this.fileQueue.length, fileInfo.relativePath);

      try {
        await this.processFile(fileInfo);
      } catch (error) {
        this.log(`Error processing ${fileInfo.relativePath}: ${error instanceof Error ? error.message : String(error)}`);
      }

      processed++;
    }

    this.log(`Folder scan complete. Processed ${processed} files.`);

    if (this.config.watchForChanges) {
      await this.startWatcher(folderPath);
    }
  }

  private resolvePath(folderPath: string): string {
    if (folderPath.startsWith('~')) {
      const home = process.env.HOME || process.env.USERPROFILE || '/';
      return path.join(home, folderPath.substring(1));
    }
    if (!path.isAbsolute(folderPath)) {
      return path.resolve(process.cwd(), folderPath);
    }
    return folderPath;
  }

  private async collectFiles(dirPath: string, basePath: string): Promise<void> {
    if (!this.shouldContinue()) return;

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!this.shouldContinue()) break;

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);

      if (this.isExcluded(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        if (this.config.recursive) {
          await this.collectFiles(fullPath, basePath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        
        if (this.config.fileTypes.includes(ext)) {
          const fileStats = fs.statSync(fullPath);
          this.fileQueue.push({
            path: fullPath,
            relativePath,
            size: fileStats.size,
            modifiedTime: fileStats.mtime,
            extension: ext
          });
        }
      }
    }
  }

  private isExcluded(relativePath: string): boolean {
    if (!this.config.excludePatterns || this.config.excludePatterns.length === 0) {
      return false;
    }

    for (const pattern of this.config.excludePatterns) {
      const regex = this.globToRegex(pattern);
      if (regex.test(relativePath)) {
        return true;
      }
    }

    return false;
  }

  private globToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`, 'i');
  }

  private async processFile(fileInfo: FileInfo): Promise<void> {
    this.log(`Processing: ${fileInfo.relativePath}`);

    let content: string;
    
    try {
      content = await this.extractContent(fileInfo);
    } catch (error) {
      throw new Error(`Failed to extract content: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!content || content.trim().length < 10) {
      this.log(`Skipping file with insufficient content: ${fileInfo.relativePath}`);
      return;
    }

    const doc: ExtractedDocument = {
      externalId: this.fileToId(fileInfo.path),
      title: this.extractTitle(fileInfo, content),
      content: content.trim(),
      url: `file://${fileInfo.path}`,
      attributes: {
        filename: path.basename(fileInfo.path),
        filePath: fileInfo.path,
        relativePath: fileInfo.relativePath,
        extension: fileInfo.extension,
        fileSize: fileInfo.size,
        modifiedAt: fileInfo.modifiedTime.toISOString()
      },
      lastModified: fileInfo.modifiedTime
    };

    this.emitDocument(doc);
  }

  private async extractContent(fileInfo: FileInfo): Promise<string> {
    switch (fileInfo.extension) {
      case '.txt':
        return this.extractText(fileInfo.path);
      case '.md':
        return this.extractMarkdown(fileInfo.path);
      case '.html':
      case '.htm':
        return this.extractHtml(fileInfo.path);
      case '.pdf':
        return this.extractPdf(fileInfo.path);
      case '.docx':
        return this.extractDocx(fileInfo.path);
      default:
        throw new Error(`Unsupported file type: ${fileInfo.extension}`);
    }
  }

  private extractText(filePath: string): string {
    return fs.readFileSync(filePath, 'utf-8');
  }

  private extractMarkdown(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/^[-*_]{3,}$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private extractHtml(filePath: string): string {
    const html = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(html);

    $('script, style, nav, header, footer, aside, noscript').remove();

    const text = $('body').text() || $.root().text();

    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
  }

  private async extractPdf(filePath: string): Promise<string> {
    const pdf = await loadPdfParse();
    if (!pdf) {
      throw new Error('PDF support not available. Install pdf-parse package.');
    }

    const buffer = fs.readFileSync(filePath);
    const data = await pdf(buffer);
    return data.text || '';
  }

  private async extractDocx(filePath: string): Promise<string> {
    const mam = await loadMammoth();
    if (!mam) {
      throw new Error('DOCX support not available. Install mammoth package.');
    }

    const buffer = fs.readFileSync(filePath);
    const result = await mam.extractRawText({ buffer });
    return result.value || '';
  }

  private extractTitle(fileInfo: FileInfo, content: string): string {
    const filename = path.basename(fileInfo.path, fileInfo.extension);
    
    if (fileInfo.extension === '.md') {
      const headerMatch = content.match(/^#\s+(.+)$/m);
      if (headerMatch) {
        return headerMatch[1].trim();
      }
    } else if (fileInfo.extension === '.html' || fileInfo.extension === '.htm') {
      const html = fs.readFileSync(fileInfo.path, 'utf-8');
      const $ = cheerio.load(html);
      const title = $('title').text();
      if (title) {
        return title.trim();
      }
    }

    return filename
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  private fileToId(filePath: string): string {
    return Buffer.from(filePath).toString('base64url').substring(0, 64);
  }

  private async startWatcher(folderPath: string): Promise<void> {
    const chok = await loadChokidar();
    if (!chok) {
      this.log('File watching not available. Install chokidar package.');
      return;
    }

    this.log('Starting file watcher...');

    const extensions = this.config.fileTypes.map(ext => ext.replace('.', '')).join(',');
    const pattern = this.config.recursive 
      ? `${folderPath}/**/*.{${extensions}}`
      : `${folderPath}/*.{${extensions}}`;

    this.watcher = chok.watch(pattern, {
      ignored: this.config.excludePatterns || [],
      persistent: true,
      ignoreInitial: true
    });

    this.watcher
      .on('add', (filePath: string) => {
        this.log(`File added: ${filePath}`);
        this.handleFileChange(filePath, folderPath);
      })
      .on('change', (filePath: string) => {
        this.log(`File changed: ${filePath}`);
        this.handleFileChange(filePath, folderPath);
      })
      .on('unlink', (filePath: string) => {
        this.log(`File deleted: ${filePath}`);
        this.emit('delete', this.fileToId(filePath));
      })
      .on('error', (error: Error) => {
        this.log(`Watcher error: ${error.message}`);
      });

    this.log('File watcher started');
  }

  private async handleFileChange(filePath: string, basePath: string): Promise<void> {
    try {
      const fileStats = fs.statSync(filePath);
      const fileInfo: FileInfo = {
        path: filePath,
        relativePath: path.relative(basePath, filePath),
        size: fileStats.size,
        modifiedTime: fileStats.mtime,
        extension: path.extname(filePath).toLowerCase()
      };

      await this.processFile(fileInfo);
    } catch (error) {
      this.log(`Error handling file change: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  stopWatcher(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.log('File watcher stopped');
    }
  }
}
