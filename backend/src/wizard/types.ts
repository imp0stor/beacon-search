/**
 * AI Config Wizard Types
 */

export interface WizardSession {
  id: string;
  userId?: string;
  platform?: string;
  template?: IntegrationTemplate;
  config: Partial<SourceConfig>;
  messages: WizardMessage[];
  state: WizardState;
  createdAt: Date;
  updatedAt: Date;
}

export type WizardState = 
  | 'init'
  | 'platform_selection'
  | 'auth_config'
  | 'endpoint_config'
  | 'mapping_config'
  | 'testing'
  | 'complete'
  | 'error';

export interface WizardMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface IntegrationTemplate {
  name: string;
  type: 'rest' | 'graphql' | 'sql' | 'file' | 'custom';
  description: string;
  icon: string;
  category: string;
  auth: AuthConfig;
  endpoints: Record<string, EndpointConfig>;
  mapping: Record<string, MappingConfig>;
  rate_limit?: RateLimitConfig;
  features?: string[];
  docs_url?: string;
}

export interface AuthConfig {
  type: 'oauth2' | 'api_key' | 'basic' | 'token' | 'none';
  fields: AuthField[];
  oauth_urls?: {
    authorize: string;
    token: string;
  };
  scopes?: string[];
  headers?: Record<string, string>;
}

export interface AuthField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'email' | 'select';
  required: boolean;
  placeholder?: string;
  default?: string;
  help?: string;
  options?: string[];
  show_if?: string;
}

export interface EndpointConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'PROPFIND';
  params?: Record<string, any>;
  body?: any;
  headers?: Record<string, string>;
  pagination?: PaginationConfig;
}

export interface PaginationConfig {
  type: 'cursor' | 'page' | 'offset';
  cursor_param?: string;
  page_param?: string;
  offset_param?: string;
  limit_param?: string;
  next_field?: string;
  results_field?: string;
  total_field?: string;
  has_more_field?: string;
}

export interface MappingConfig {
  id: string;
  title: string;
  content: string;
  content_type?: string;
  url?: string;
  author?: string;
  modified?: string;
  created?: string;
  document_type?: string;
  attributes?: Record<string, string>;
}

export interface RateLimitConfig {
  requests_per_minute?: number;
  requests_per_second?: number;
  concurrent?: number;
  daily_limit?: number;
}

export interface SourceConfig {
  name: string;
  description?: string;
  template: string;
  auth: Record<string, string>;
  endpoints?: Record<string, EndpointConfig>;
  mapping?: MappingConfig;
  filters?: Record<string, any>;
  schedule?: ScheduleConfig;
  enabled: boolean;
}

export interface ScheduleConfig {
  type: 'interval' | 'cron';
  interval_minutes?: number;
  cron_expression?: string;
  timezone?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface TestResult {
  success: boolean;
  message: string;
  details?: {
    auth_status?: 'ok' | 'failed';
    endpoint_status?: Record<string, 'ok' | 'failed' | 'skipped'>;
    sample_documents?: number;
    errors?: string[];
  };
}

export interface PlatformDetectionResult {
  detected: boolean;
  platform?: string;
  template?: string;
  confidence: number;
  suggestions?: string[];
}
