/**
 * Plugin Registry
 * Central export for all Beacon Search plugins
 */

export { Plugin, PluginContext, PluginRoute, SearchDocument, SearchQuery, Logger, CacheClient } from './types';
export { PluginManager } from './manager';
export { WoTPlugin, WoTPluginConfig } from './wot';
export { WoTProvider, NostrMaxiProvider, LocalWoTProvider, createWoTProvider } from './wot/providers';
