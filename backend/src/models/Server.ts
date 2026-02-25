export type ServerType = 'postgresql' | 'mysql' | 'web' | 'nostr' | 'api';

export type ServerAuthType = 'password' | 'apikey' | 'oauth' | 'none';

export interface Server {
  id: string;
  name: string;
  type: ServerType;
  host: string | null;
  port: number | null;
  database_name: string | null;
  auth_type: ServerAuthType | null;
  auth_config: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateServerInput {
  name: string;
  type: ServerType;
  host?: string | null;
  port?: number | null;
  database_name?: string | null;
  auth_type?: ServerAuthType | null;
  auth_config?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateServerInput extends Partial<CreateServerInput> {}
