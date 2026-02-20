/**
 * Base Connector Class
 * Abstract class that all connectors extend
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  Connector,
  ConnectorRun,
  ExtractedDocument
} from './types';

export abstract class BaseConnector extends EventEmitter {
  protected connector: Connector;
  protected currentRun: ConnectorRun | null = null;
  protected shouldStop: boolean = false;

  constructor(connector: Connector) {
    super();
    this.connector = connector;
  }

  async run(): Promise<ConnectorRun> {
    if (this.currentRun && this.currentRun.status === 'running') {
      throw new Error('Connector is already running');
    }

    this.shouldStop = false;
    this.currentRun = {
      id: uuidv4(),
      connectorId: this.connector.id,
      status: 'running',
      startedAt: new Date(),
      documentsAdded: 0,
      documentsUpdated: 0,
      documentsRemoved: 0,
      progress: 0,
      processedItems: 0,
      log: []
    };

    this.log(`Starting ${this.connector.config.type} connector: ${this.connector.name}`);
    this.emit('start', this.currentRun);

    try {
      await this.execute();
      
      if (this.shouldStop) {
        this.currentRun.status = 'stopped';
        this.log('Connector stopped by user');
      } else {
        this.currentRun.status = 'completed';
        this.log('Connector completed successfully');
      }
    } catch (error) {
      this.currentRun.status = 'failed';
      this.currentRun.errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`Error: ${this.currentRun.errorMessage}`);
      this.emit('error', error, this.currentRun);
    }

    this.currentRun.completedAt = new Date();
    this.currentRun.progress = 100;
    this.emit('complete', this.currentRun);

    return this.currentRun;
  }

  stop(): void {
    this.shouldStop = true;
    this.log('Stop requested');
  }

  getStatus(): ConnectorRun | null {
    return this.currentRun;
  }

  protected shouldContinue(): boolean {
    return !this.shouldStop;
  }

  protected log(message: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    
    if (this.currentRun) {
      this.currentRun.log.push(logEntry);
      if (this.currentRun.log.length > 1000) {
        this.currentRun.log = this.currentRun.log.slice(-500);
      }
    }
    
    console.log(`[Connector:${this.connector.name}] ${message}`);
    this.emit('log', logEntry);
  }

  protected updateProgress(processed: number, total: number, current?: string): void {
    if (!this.currentRun) return;

    this.currentRun.processedItems = processed;
    this.currentRun.totalItems = total;
    this.currentRun.progress = total > 0 ? Math.round((processed / total) * 100) : 0;
    
    if (current) {
      if (this.connector.config.type === 'web') {
        this.currentRun.currentUrl = current;
      } else if (this.connector.config.type === 'folder') {
        this.currentRun.currentFile = current;
      }
    }

    this.emit('progress', this.currentRun);
  }

  protected emitDocument(doc: ExtractedDocument, isUpdate: boolean = false): void {
    if (!this.currentRun) return;

    if (isUpdate) {
      this.currentRun.documentsUpdated++;
    } else {
      this.currentRun.documentsAdded++;
    }

    this.emit('document', doc);
  }

  protected abstract execute(): Promise<void>;
}
