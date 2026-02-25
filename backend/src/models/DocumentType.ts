export interface DocumentTypeField {
  name: string;
  type: string;
  required?: boolean;
  searchable?: boolean;
  [key: string]: unknown;
}

export interface DocumentType {
  id: string;
  name: string;
  display_name: string | null;
  description: string | null;
  fields: DocumentTypeField[];
  display_template: string | null;
  relevancy_config: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateDocumentTypeInput {
  name: string;
  display_name?: string | null;
  description?: string | null;
  fields: DocumentTypeField[];
  display_template?: string | null;
  relevancy_config?: Record<string, unknown> | null;
}

export interface UpdateDocumentTypeInput extends Partial<CreateDocumentTypeInput> {}
