/**
 * Plugin Manager
 * Loads and manages plugins
 */

import { Plugin, PluginContext } from './types';
import { promises as fs } from 'fs';
import path from 'path';

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
  }

  /**
   * Register a plugin
   */
  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} is already registered`);
    }

    this.context.logger.info(`Registering plugin: ${plugin.name} v${plugin.version}`);
    this.plugins.set(plugin.name, plugin);
  }

  /**
   * Initialize all plugins
   */
  async initAll(): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      if (plugin.init) {
        this.context.logger.info(`Initializing plugin: ${name}`);
        try {
          await plugin.init(this.context);
        } catch (error) {
          this.context.logger.error(`Failed to initialize plugin ${name}:`, error);
        }
      }
    }
  }

  /**
   * Apply all plugins to modify search score
   */
  async modifySearchScore(doc: any, query: any, baseScore: number): Promise<number> {
    let score = baseScore;

    for (const plugin of this.plugins.values()) {
      if (plugin.modifySearchScore) {
        try {
          score = await plugin.modifySearchScore(doc, query, score);
        } catch (error) {
          this.context.logger.error(`Plugin ${plugin.name} search score modification failed:`, error);
        }
      }
    }

    return score;
  }

  /**
   * Before document index hooks
   */
  async beforeIndex(doc: any): Promise<any> {
    let modifiedDoc = doc;

    for (const plugin of this.plugins.values()) {
      if (plugin.beforeIndex) {
        try {
          modifiedDoc = await plugin.beforeIndex(modifiedDoc);
        } catch (error) {
          this.context.logger.error(`Plugin ${plugin.name} beforeIndex failed:`, error);
        }
      }
    }

    return modifiedDoc;
  }

  /**
   * After document index hooks
   */
  async afterIndex(doc: any): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.afterIndex) {
        try {
          await plugin.afterIndex(doc);
        } catch (error) {
          this.context.logger.error(`Plugin ${plugin.name} afterIndex failed:`, error);
        }
      }
    }
  }

  /**
   * Get all plugin routes
   */
  getRoutes(): any[] {
    const routes: any[] = [];

    for (const plugin of this.plugins.values()) {
      if (plugin.routes) {
        routes.push(...plugin.routes);
      }
    }

    return routes;
  }

  /**
   * Shutdown all plugins
   */
  async destroyAll(): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      if (plugin.destroy) {
        this.context.logger.info(`Destroying plugin: ${name}`);
        try {
          await plugin.destroy();
        } catch (error) {
          this.context.logger.error(`Failed to destroy plugin ${name}:`, error);
        }
      }
    }
  }

  /**
   * Get plugin by name
   */
  get(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * List all registered plugins
   */
  list(): Plugin[] {
    return Array.from(this.plugins.values());
  }
}
