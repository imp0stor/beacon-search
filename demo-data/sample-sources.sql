-- Sample Data Sources for Beacon Search Demo
-- This creates example integrations to showcase all 39 integration types

-- =============================================================================
-- ENTERPRISE SAAS SOURCES (19)
-- =============================================================================

-- 1. Notion - Product Workspace
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Product Notion Workspace', 'Product team documentation and roadmaps', 'notion_page', 'rest', 
  '{"integration": "notion", "oauth_client_id": "demo", "oauth_client_secret": "demo"}',
  'SELECT id, last_edited_time FROM notion_pages',
  'SELECT * FROM notion_pages WHERE id = ANY($1)',
  'https://notion.so/{external_id}',
  '0 */4 * * *', true);

-- 2. Slack - Engineering Channel
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Engineering Slack', 'Engineering team conversations and decisions', 'slack_message', 'rest',
  '{"integration": "slack", "bot_token": "xoxb-demo", "channels": ["engineering", "announcements"]}',
  'SELECT ts, updated FROM messages',
  'SELECT * FROM messages WHERE ts = ANY($1)',
  'https://company.slack.com/archives/{attr_channel_id}/p{external_id}',
  '0 */1 * * *', true);

-- 3. Jira - Product Issues
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Product Jira', 'Product team issues and feature requests', 'jira_issue', 'rest',
  '{"integration": "jira", "base_url": "https://company.atlassian.net", "api_token": "demo", "projects": ["PROD", "FEAT"]}',
  'SELECT key, updated FROM issues',
  'SELECT * FROM issues WHERE key = ANY($1)',
  'https://company.atlassian.net/browse/{external_id}',
  '0 */2 * * *', true);

-- 4. Confluence - Engineering Wiki
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Engineering Confluence', 'Engineering documentation and runbooks', 'confluence_page', 'rest',
  '{"integration": "confluence", "base_url": "https://confluence.company.com", "api_token": "demo", "spaces": ["ENG", "DEV", "OPS"]}',
  'SELECT id, version_when FROM pages',
  'SELECT * FROM pages WHERE id = ANY($1)',
  'https://confluence.company.com/display/{attr_space}/{external_id}',
  '0 */6 * * *', true);

-- 5. SharePoint - HR Documents
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('HR SharePoint', 'HR policies and employee handbook', 'sharepoint_doc', 'rest',
  '{"integration": "sharepoint", "site_url": "https://company.sharepoint.com/sites/hr", "oauth_client_id": "demo"}',
  'SELECT id, modified FROM documents',
  'SELECT * FROM documents WHERE id = ANY($1)',
  'https://company.sharepoint.com/sites/hr/_layouts/Doc.aspx?sourcedoc={external_id}',
  '0 2 * * *', true);

-- 6. OneDrive - Sales Presentations
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Sales OneDrive', 'Sales presentations and pitch decks', 'onedrive_file', 'rest',
  '{"integration": "onedrive", "oauth_client_id": "demo", "folders": ["/Sales", "/Presentations"]}',
  'SELECT id, last_modified FROM files',
  'SELECT * FROM files WHERE id = ANY($1)',
  'https://company-my.sharepoint.com/:p:/g/personal/sales/{external_id}',
  '0 4 * * *', true);

-- 7. Google Drive - Marketing Assets
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Marketing Google Drive', 'Marketing campaigns and creative assets', 'gdrive_file', 'rest',
  '{"integration": "google-drive", "oauth_client_id": "demo", "folders": ["Marketing", "Campaigns"]}',
  'SELECT id, modified_time FROM files',
  'SELECT * FROM files WHERE id = ANY($1)',
  'https://drive.google.com/file/d/{external_id}/view',
  '0 3 * * *', true);

-- 8. Salesforce - Customer Data
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Salesforce CRM', 'Customer accounts and opportunities', 'salesforce_record', 'rest',
  '{"integration": "salesforce", "instance_url": "https://company.salesforce.com", "oauth_client_id": "demo"}',
  'SELECT Id, LastModifiedDate FROM Account',
  'SELECT * FROM Account WHERE Id = ANY($1)',
  'https://company.salesforce.com/{external_id}',
  '0 */8 * * *', true);

-- 9. ServiceNow - IT Tickets
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('ServiceNow ITSM', 'IT support tickets and knowledge base', 'servicenow_incident', 'rest',
  '{"integration": "servicenow", "instance_url": "https://company.service-now.com", "api_token": "demo"}',
  'SELECT sys_id, sys_updated_on FROM incident',
  'SELECT * FROM incident WHERE sys_id = ANY($1)',
  'https://company.service-now.com/nav_to.do?uri=incident.do?sys_id={external_id}',
  '0 */4 * * *', true);

-- 10. Zendesk - Support Tickets
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Zendesk Support', 'Customer support tickets and articles', 'zendesk_ticket', 'rest',
  '{"integration": "zendesk", "subdomain": "company", "api_token": "demo"}',
  'SELECT id, updated_at FROM tickets',
  'SELECT * FROM tickets WHERE id = ANY($1)',
  'https://company.zendesk.com/agent/tickets/{external_id}',
  '0 */3 * * *', true);

-- 11. Freshdesk - Customer Support
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Freshdesk Support', 'Customer support portal', 'freshdesk_ticket', 'rest',
  '{"integration": "freshdesk", "domain": "company.freshdesk.com", "api_key": "demo"}',
  'SELECT id, updated_at FROM tickets',
  'SELECT * FROM tickets WHERE id = ANY($1)',
  'https://company.freshdesk.com/a/tickets/{external_id}',
  '0 */3 * * *', true);

-- 12. Intercom - Customer Messages
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Intercom Conversations', 'Customer conversations and help articles', 'intercom_conversation', 'rest',
  '{"integration": "intercom", "access_token": "demo"}',
  'SELECT id, updated_at FROM conversations',
  'SELECT * FROM conversations WHERE id = ANY($1)',
  'https://app.intercom.com/a/apps/company/inbox/inbox/conversation/{external_id}',
  '0 */2 * * *', true);

-- 13. HubSpot - Marketing Hub
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('HubSpot Marketing', 'Marketing contacts and blog posts', 'hubspot_content', 'rest',
  '{"integration": "hubspot", "api_key": "demo", "portal_id": "12345"}',
  'SELECT id, updated FROM blog_posts',
  'SELECT * FROM blog_posts WHERE id = ANY($1)',
  'https://app.hubspot.com/blog/{attr_portal_id}/{external_id}',
  '0 5 * * *', true);

-- 14. Asana - Project Tasks
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Product Asana', 'Product roadmap and tasks', 'asana_task', 'rest',
  '{"integration": "asana", "access_token": "demo", "workspaces": ["Product Team"]}',
  'SELECT gid, modified_at FROM tasks',
  'SELECT * FROM tasks WHERE gid = ANY($1)',
  'https://app.asana.com/0/{attr_project_gid}/{external_id}',
  '0 */4 * * *', true);

-- 15. Monday.com - Workflow Boards
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Monday Boards', 'Project tracking and workflows', 'monday_item', 'rest',
  '{"integration": "monday", "api_token": "demo", "boards": ["Engineering Sprint", "Product Roadmap"]}',
  'SELECT id, updated_at FROM items',
  'SELECT * FROM items WHERE id = ANY($1)',
  'https://company.monday.com/boards/{attr_board_id}/pulses/{external_id}',
  '0 */4 * * *', true);

-- 16. Airtable - Product Database
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Product Airtable', 'Product features and specifications', 'airtable_record', 'rest',
  '{"integration": "airtable", "api_key": "demo", "base_id": "appXXXXX", "tables": ["Features", "Specs"]}',
  'SELECT id, modified_time FROM records',
  'SELECT * FROM records WHERE id = ANY($1)',
  'https://airtable.com/{attr_base_id}/{attr_table_id}/{external_id}',
  '0 6 * * *', true);

-- 17. Box - Legal Documents
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Legal Box', 'Legal contracts and compliance docs', 'box_file', 'rest',
  '{"integration": "box", "oauth_client_id": "demo", "folders": ["/Legal", "/Contracts"]}',
  'SELECT id, modified_at FROM files',
  'SELECT * FROM files WHERE id = ANY($1)',
  'https://app.box.com/file/{external_id}',
  '0 2 * * *', true);

-- 18. Dropbox - Design Files
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Design Dropbox', 'Design files and mockups', 'dropbox_file', 'rest',
  '{"integration": "dropbox", "access_token": "demo", "folders": ["/Design", "/Mockups"]}',
  'SELECT id, client_modified FROM files',
  'SELECT * FROM files WHERE id = ANY($1)',
  'https://www.dropbox.com/home{attr_path_display}',
  '0 4 * * *', true);

-- 19. Coda - Team Docs
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Team Coda', 'Team documentation and databases', 'coda_doc', 'rest',
  '{"integration": "coda", "api_token": "demo"}',
  'SELECT id, updated_at FROM docs',
  'SELECT * FROM docs WHERE id = ANY($1)',
  'https://coda.io/d/{external_id}',
  '0 */6 * * *', true);


-- =============================================================================
-- OPEN SOURCE / SELF-HOSTED SOURCES (20)
-- =============================================================================

-- 20. GitLab - Engineering Repos
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Engineering GitLab', 'Code repositories and wikis', 'gitlab_wiki', 'rest',
  '{"integration": "gitlab", "base_url": "https://gitlab.company.com", "access_token": "demo", "content_types": ["wikis", "issues"]}',
  'SELECT slug, format FROM wikis',
  'SELECT * FROM wikis WHERE slug = ANY($1)',
  'https://gitlab.company.com/{attr_project_path}/-/wikis/{external_id}',
  '0 */6 * * *', true);

-- 21. Gitea - Public Repos
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Public Gitea', 'Open source project documentation', 'gitea_repo', 'rest',
  '{"integration": "gitea", "base_url": "https://gitea.company.com", "access_token": "demo"}',
  'SELECT id, updated_at FROM repos',
  'SELECT * FROM repos WHERE id = ANY($1)',
  'https://gitea.company.com/{attr_owner}/{attr_repo}',
  '0 3 * * *', true);

-- 22. WordPress - Company Blog
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Company Blog', 'Public blog and announcements', 'wordpress_post', 'rest',
  '{"integration": "wordpress", "base_url": "https://blog.company.com", "api_token": "demo"}',
  'SELECT id, modified FROM posts',
  'SELECT * FROM posts WHERE id = ANY($1)',
  'https://blog.company.com/?p={external_id}',
  '0 6 * * *', true);

-- 23. Ghost - Developer Blog
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Developer Blog', 'Technical blog posts', 'ghost_post', 'rest',
  '{"integration": "ghost", "base_url": "https://dev.company.com", "content_api_key": "demo"}',
  'SELECT id, updated_at FROM posts',
  'SELECT * FROM posts WHERE id = ANY($1)',
  'https://dev.company.com/{attr_slug}',
  '0 7 * * *', true);

-- 24. Strapi - Content CMS
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Content CMS', 'Website content and pages', 'strapi_entry', 'rest',
  '{"integration": "strapi", "base_url": "https://cms.company.com", "api_token": "demo"}',
  'SELECT id, updated_at FROM entries',
  'SELECT * FROM entries WHERE id = ANY($1)',
  'https://cms.company.com/admin/content-manager/collectionType/{attr_content_type}/{external_id}',
  '0 4 * * *', true);

-- 25. Directus - Headless CMS
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Product CMS', 'Product information and specs', 'directus_item', 'rest',
  '{"integration": "directus", "base_url": "https://directus.company.com", "access_token": "demo"}',
  'SELECT id, date_updated FROM items',
  'SELECT * FROM items WHERE id = ANY($1)',
  'https://directus.company.com/admin/collections/{attr_collection}/{external_id}',
  '0 5 * * *', true);

-- 26. Outline - Team Wiki
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Team Wiki', 'Internal knowledge base', 'outline_doc', 'rest',
  '{"integration": "outline", "base_url": "https://wiki.company.com", "api_token": "demo"}',
  'SELECT id, updated_at FROM documents',
  'SELECT * FROM documents WHERE id = ANY($1)',
  'https://wiki.company.com/doc/{attr_url_id}',
  '0 */6 * * *', true);

-- 27. BookStack - Documentation
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Engineering Docs', 'API and system documentation', 'bookstack_page', 'rest',
  '{"integration": "bookstack", "base_url": "https://docs.company.com", "api_token": "demo"}',
  'SELECT id, updated_at FROM pages',
  'SELECT * FROM pages WHERE id = ANY($1)',
  'https://docs.company.com/books/{attr_book_slug}/page/{attr_page_slug}',
  '0 */6 * * *', true);

-- 28. DokuWiki - IT Wiki
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('IT Documentation', 'IT runbooks and procedures', 'dokuwiki_page', 'rest',
  '{"integration": "dokuwiki", "base_url": "https://wiki.it.company.com", "api_token": "demo"}',
  'SELECT id, mtime FROM pages',
  'SELECT * FROM pages WHERE id = ANY($1)',
  'https://wiki.it.company.com/doku.php?id={external_id}',
  '0 3 * * *', true);

-- 29. MediaWiki - Product Wiki
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Product Wiki', 'Product specifications and guides', 'mediawiki_page', 'rest',
  '{"integration": "mediawiki", "base_url": "https://wiki.product.company.com", "api_token": "demo"}',
  'SELECT pageid, touched FROM pages',
  'SELECT * FROM pages WHERE pageid = ANY($1)',
  'https://wiki.product.company.com/wiki/index.php?curid={external_id}',
  '0 4 * * *', true);

-- 30. XWiki - Enterprise Wiki
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Enterprise Wiki', 'Company-wide knowledge base', 'xwiki_page', 'rest',
  '{"integration": "xwiki", "base_url": "https://xwiki.company.com", "username": "beacon", "password": "demo"}',
  'SELECT id, modified FROM pages',
  'SELECT * FROM pages WHERE id = ANY($1)',
  'https://xwiki.company.com/xwiki/bin/view/{external_id}',
  '0 */6 * * *', true);

-- 31. Docusaurus - API Docs
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('API Documentation', 'Developer API reference', 'docusaurus_page', 'folder',
  '{"integration": "docusaurus", "path": "/var/www/docs", "base_url": "https://docs.api.company.com"}',
  'SELECT path, mtime FROM files WHERE ext = ''.md''',
  'SELECT * FROM files WHERE path = ANY($1)',
  'https://docs.api.company.com/{attr_route}',
  '0 2 * * *', true);

-- 32. Mattermost - Dev Chat
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Developer Chat', 'Developer team discussions', 'mattermost_post', 'rest',
  '{"integration": "mattermost", "base_url": "https://chat.dev.company.com", "access_token": "demo"}',
  'SELECT id, update_at FROM posts',
  'SELECT * FROM posts WHERE id = ANY($1)',
  'https://chat.dev.company.com/{attr_team_name}/pl/{external_id}',
  '0 */2 * * *', true);

-- 33. Rocket.Chat - Support Chat
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Support Chat', 'Customer support chat history', 'rocketchat_message', 'rest',
  '{"integration": "rocketchat", "base_url": "https://support.company.com", "access_token": "demo"}',
  'SELECT _id, _updatedAt FROM messages',
  'SELECT * FROM messages WHERE _id = ANY($1)',
  'https://support.company.com/channel/{attr_room_name}?msg={external_id}',
  '0 */3 * * *', true);

-- 34. Discourse - Community Forum
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Community Forum', 'User community discussions', 'discourse_topic', 'rest',
  '{"integration": "discourse", "base_url": "https://community.company.com", "api_key": "demo"}',
  'SELECT id, updated_at FROM topics',
  'SELECT * FROM topics WHERE id = ANY($1)',
  'https://community.company.com/t/{attr_slug}/{external_id}',
  '0 */4 * * *', true);

-- 35. Nextcloud - File Shares
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Team Files', 'Shared team files and folders', 'nextcloud_file', 'rest',
  '{"integration": "nextcloud", "base_url": "https://cloud.company.com", "username": "beacon", "password": "demo"}',
  'SELECT fileid, mtime FROM files',
  'SELECT * FROM files WHERE fileid = ANY($1)',
  'https://cloud.company.com/f/{external_id}',
  '0 3 * * *', true);

-- 36. Odoo - ERP Modules
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Company ERP', 'CRM, sales, and project data', 'odoo_record', 'rest',
  '{"integration": "odoo", "base_url": "https://erp.company.com", "db": "company", "username": "beacon", "api_key": "demo"}',
  'SELECT id, write_date FROM records',
  'SELECT * FROM records WHERE id = ANY($1)',
  'https://erp.company.com/web#id={external_id}&model={attr_model}',
  '0 */8 * * *', true);

-- 37. ERPNext - Business Data
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('ERPNext System', 'Sales and project management', 'erpnext_doc', 'rest',
  '{"integration": "erpnext", "base_url": "https://erpnext.company.com", "api_key": "demo"}',
  'SELECT name, modified FROM docs',
  'SELECT * FROM docs WHERE name = ANY($1)',
  'https://erpnext.company.com/app/{attr_doctype}/{external_id}',
  '0 */8 * * *', true);

-- 38. Zammad - Helpdesk
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('IT Helpdesk', 'Internal IT support tickets', 'zammad_ticket', 'rest',
  '{"integration": "zammad", "base_url": "https://helpdesk.company.com", "access_token": "demo"}',
  'SELECT id, updated_at FROM tickets',
  'SELECT * FROM tickets WHERE id = ANY($1)',
  'https://helpdesk.company.com/#ticket/zoom/{external_id}',
  '0 */4 * * *', true);

-- 39. Local Documentation Folder
INSERT INTO data_sources (name, description, document_type, source_type, connection_config, metadata_query, data_query, url_template, sync_schedule, is_active) VALUES
('Local Docs', 'Local markdown and PDF documentation', 'folder_file', 'folder',
  '{"integration": "folder", "path": "/data/documentation", "recursive": true, "file_types": [".md", ".pdf", ".docx", ".html"], "watch": true}',
  'SELECT path, mtime FROM files',
  'SELECT * FROM files WHERE path = ANY($1)',
  'file://{attr_path}',
  NULL, true);  -- Watch mode, no schedule needed


-- =============================================================================
-- SAMPLE DOCUMENTS FROM EACH SOURCE
-- =============================================================================

-- Create sample documents to demonstrate search capabilities
-- (In production, these would be synced from actual sources)

-- Engineering Wiki samples
INSERT INTO documents (external_id, source_id, document_type, title, content, url, author, created, modified, attributes, permission_groups)
SELECT 
  'wiki-' || generate_series,
  (SELECT id FROM data_sources WHERE name = 'Engineering Confluence'),
  'confluence_page',
  'Engineering Runbook: ' || (ARRAY['Database Backup', 'Deployment Process', 'Incident Response', 'API Guidelines', 'Security Best Practices'])[mod(generate_series, 5) + 1],
  'Detailed procedures and guidelines for ' || (ARRAY['database backups', 'deployment automation', 'incident handling', 'API development', 'security compliance'])[mod(generate_series, 5) + 1] || '. This document contains step-by-step instructions, code examples, and troubleshooting tips.',
  'https://confluence.company.com/display/ENG/runbook-' || generate_series,
  (ARRAY['Alice Johnson', 'Bob Smith', 'Charlie Chen', 'Diana Martinez'])[mod(generate_series, 4) + 1],
  NOW() - (random() * interval '180 days'),
  NOW() - (random() * interval '30 days'),
  jsonb_build_object('space', 'ENG', 'labels', ARRAY['runbook', 'engineering']),
  ARRAY['confluence:space:ENG']
FROM generate_series(1, 20);

-- Slack conversations samples
INSERT INTO documents (external_id, source_id, document_type, title, content, url, author, created, modified, attributes, permission_groups)
SELECT 
  'slack-' || generate_series,
  (SELECT id FROM data_sources WHERE name = 'Engineering Slack'),
  'slack_message',
  '#engineering - ' || (ARRAY['Code Review Discussion', 'Architecture Decision', 'Bug Triage', 'Feature Planning', 'Tech Debt'])[mod(generate_series, 5) + 1],
  'Team discussion about ' || (ARRAY['code quality', 'system architecture', 'critical bugs', 'upcoming features', 'technical debt'])[mod(generate_series, 5) + 1] || '. Multiple team members contributed insights and made decisions.',
  'https://company.slack.com/archives/C01234/p' || generate_series,
  (ARRAY['alice', 'bob', 'charlie', 'diana'])[mod(generate_series, 4) + 1],
  NOW() - (random() * interval '7 days'),
  NOW() - (random() * interval '7 days'),
  jsonb_build_object('channel_id', 'C01234', 'channel_name', 'engineering'),
  ARRAY['slack:channel:C01234']
FROM generate_series(1, 50);

-- Product Jira issues
INSERT INTO documents (external_id, source_id, document_type, title, content, url, author, created, modified, attributes, permission_groups)
SELECT 
  'PROD-' || generate_series,
  (SELECT id FROM data_sources WHERE name = 'Product Jira'),
  'jira_issue',
  (ARRAY['[Feature]', '[Bug]', '[Enhancement]', '[Task]'])[mod(generate_series, 4) + 1] || ' ' || (ARRAY['User Authentication', 'Search Performance', 'Mobile Responsiveness', 'API Documentation', 'Data Export'])[mod(generate_series, 5) + 1],
  'Issue description with acceptance criteria, technical details, and discussion. Priority: ' || (ARRAY['High', 'Medium', 'Low'])[mod(generate_series, 3) + 1],
  'https://company.atlassian.net/browse/PROD-' || generate_series,
  (ARRAY['Alice Johnson', 'Bob Smith', 'Charlie Chen'])[mod(generate_series, 3) + 1],
  NOW() - (random() * interval '90 days'),
  NOW() - (random() * interval '14 days'),
  jsonb_build_object(
    'state', (ARRAY['To Do', 'In Progress', 'Done'])[mod(generate_series, 3) + 1],
    'labels', ARRAY['product', 'engineering'],
    'milestone', 'Q1 2024'
  ),
  ARRAY['jira:project:PROD']
FROM generate_series(1, 100);

-- GitLab wiki pages
INSERT INTO documents (external_id, source_id, document_type, title, content, url, author, created, modified, attributes, permission_groups)
SELECT 
  'wiki-' || generate_series,
  (SELECT id FROM data_sources WHERE name = 'Engineering GitLab'),
  'gitlab_wiki',
  (ARRAY['Getting Started Guide', 'Architecture Overview', 'Contributing Guidelines', 'Testing Strategy', 'Deployment Guide'])[mod(generate_series, 5) + 1],
  'Comprehensive guide covering ' || (ARRAY['onboarding steps', 'system architecture', 'contribution process', 'testing approach', 'deployment workflow'])[mod(generate_series, 5) + 1] || ' with examples and best practices.',
  'https://gitlab.company.com/engineering/docs/-/wikis/guide-' || generate_series,
  (ARRAY['Alice Johnson', 'Bob Smith', 'Charlie Chen'])[mod(generate_series, 3) + 1],
  NOW() - (random() * interval '120 days'),
  NOW() - (random() * interval '20 days'),
  jsonb_build_object('project_path', 'engineering/docs'),
  ARRAY['gitlab:project:42']
FROM generate_series(1, 30);

-- Support tickets from Zendesk
INSERT INTO documents (external_id, source_id, document_type, title, content, url, author, created, modified, attributes, permission_groups)
SELECT 
  'zendesk-' || generate_series,
  (SELECT id FROM data_sources WHERE name = 'Zendesk Support'),
  'zendesk_ticket',
  'Customer Issue: ' || (ARRAY['Login Problem', 'Data Export Request', 'Feature Question', 'Bug Report', 'Account Access'])[mod(generate_series, 5) + 1],
  'Customer reported issue with ' || (ARRAY['authentication', 'data export', 'feature usage', 'application bug', 'account permissions'])[mod(generate_series, 5) + 1] || '. Support team provided resolution steps and workarounds.',
  'https://company.zendesk.com/agent/tickets/' || generate_series,
  'Support Team',
  NOW() - (random() * interval '60 days'),
  NOW() - (random() * interval '10 days'),
  jsonb_build_object('status', (ARRAY['open', 'pending', 'solved'])[mod(generate_series, 3) + 1]),
  ARRAY['zendesk:group:support']
FROM generate_series(1, 75);

-- Update document counts for stats
ANALYZE documents;
