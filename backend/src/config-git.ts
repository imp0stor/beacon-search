/**
 * Git-Versioned Configuration Management
 * Handles version control for Beacon Search configurations
 */

import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

// Configuration repository path
const CONFIG_REPO_PATH = process.env.CONFIG_REPO_PATH || path.join(__dirname, '../../config-repo');

interface GitStatus {
  initialized: boolean;
  branch: string;
  clean: boolean;
  staged: string[];
  modified: string[];
  untracked: string[];
  ahead: number;
  behind: number;
  remoteUrl?: string;
}

interface GitCommit {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  email: string;
  date: Date;
  files: string[];
}

interface GitDiff {
  file: string;
  changes: {
    added: number;
    removed: number;
  };
  hunks: {
    header: string;
    lines: string[];
  }[];
}

export function createConfigGitRoutes(): Router {
  const router = Router();
  
  // Initialize git repository
  router.post('/init', async (req: Request, res: Response) => {
    try {
      const { remoteUrl, branch } = req.body;
      
      // Ensure config-repo directory exists
      if (!fs.existsSync(CONFIG_REPO_PATH)) {
        fs.mkdirSync(CONFIG_REPO_PATH, { recursive: true });
      }
      
      // Check if already a git repo
      const gitDir = path.join(CONFIG_REPO_PATH, '.git');
      if (fs.existsSync(gitDir)) {
        return res.json({ message: 'Repository already initialized', path: CONFIG_REPO_PATH });
      }
      
      // Initialize git
      await execAsync('git init', { cwd: CONFIG_REPO_PATH });
      
      // Set default branch
      const defaultBranch = branch || 'main';
      await execAsync(`git checkout -b ${defaultBranch}`, { cwd: CONFIG_REPO_PATH });
      
      // Create initial directory structure
      const dirs = ['sources', 'ontology', 'dictionary', 'triggers', 'webhooks'];
      for (const dir of dirs) {
        const dirPath = path.join(CONFIG_REPO_PATH, dir);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
          // Create .gitkeep to track empty directories
          fs.writeFileSync(path.join(dirPath, '.gitkeep'), '');
        }
      }
      
      // Create README
      const readme = `# Beacon Search Configuration Repository

This repository contains the configuration for your Beacon Search instance.

## Structure

\`\`\`
config-repo/
├── sources/           # Data source configurations
│   ├── confluence-internal.yaml
│   ├── sharepoint-docs.yaml
│   └── ...
├── ontology/          # Term hierarchy definitions
│   └── terms.yaml
├── dictionary/        # Synonyms and acronyms
│   └── synonyms.yaml
├── triggers/          # Search behavior rules
│   └── search-rules.yaml
├── webhooks/          # Webhook configurations
│   └── notifications.yaml
└── README.md
\`\`\`

## Usage

1. Edit configurations in this repository
2. Commit changes
3. Push to remote (if configured)
4. Changes are automatically applied

## Environment Variables

Store secrets in environment variables, not in config files:
- \`CONFLUENCE_API_TOKEN\`
- \`SHAREPOINT_CLIENT_SECRET\`
- etc.
`;
      
      fs.writeFileSync(path.join(CONFIG_REPO_PATH, 'README.md'), readme);
      
      // Create sample configs
      createSampleConfigs();
      
      // Initial commit
      await execAsync('git add -A', { cwd: CONFIG_REPO_PATH });
      await execAsync('git commit -m "Initial configuration repository setup"', { cwd: CONFIG_REPO_PATH });
      
      // Add remote if provided
      if (remoteUrl) {
        await execAsync(`git remote add origin ${remoteUrl}`, { cwd: CONFIG_REPO_PATH });
      }
      
      res.json({
        message: 'Repository initialized successfully',
        path: CONFIG_REPO_PATH,
        branch: defaultBranch,
        remote: remoteUrl || null
      });
    } catch (error: any) {
      console.error('Git init error:', error);
      res.status(500).json({ error: 'Failed to initialize repository', details: error.message });
    }
  });
  
  // Get git status
  router.get('/status', async (_req: Request, res: Response) => {
    try {
      const status = await getGitStatus();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to get status', details: error.message });
    }
  });
  
  // Get commit history
  router.get('/history', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = parseInt(req.query.skip as string) || 0;
      const file = req.query.file as string;
      
      let command = `git log --format="%H|%h|%s|%an|%ae|%aI" -n ${limit} --skip ${skip}`;
      if (file) {
        command += ` -- ${file}`;
      }
      
      const { stdout } = await execAsync(command, { cwd: CONFIG_REPO_PATH });
      
      const commits: GitCommit[] = stdout.trim().split('\n')
        .filter(line => line)
        .map(line => {
          const [sha, shortSha, message, author, email, date] = line.split('|');
          return {
            sha,
            shortSha,
            message,
            author,
            email,
            date: new Date(date),
            files: []
          };
        });
      
      // Get files changed for each commit
      for (const commit of commits) {
        try {
          const { stdout: files } = await execAsync(
            `git show --name-only --format="" ${commit.sha}`,
            { cwd: CONFIG_REPO_PATH }
          );
          commit.files = files.trim().split('\n').filter(f => f);
        } catch {}
      }
      
      res.json({ commits, total: commits.length });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to get history', details: error.message });
    }
  });
  
  // Commit changes
  router.post('/commit', async (req: Request, res: Response) => {
    try {
      const { message, files } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'Commit message is required' });
      }
      
      // Stage files
      if (files && files.length > 0) {
        for (const file of files) {
          await execAsync(`git add "${file}"`, { cwd: CONFIG_REPO_PATH });
        }
      } else {
        await execAsync('git add -A', { cwd: CONFIG_REPO_PATH });
      }
      
      // Check if there are changes to commit
      const { stdout: status } = await execAsync('git status --porcelain', { cwd: CONFIG_REPO_PATH });
      if (!status.trim()) {
        return res.json({ message: 'No changes to commit' });
      }
      
      // Commit
      const { stdout } = await execAsync(
        `git commit -m "${message.replace(/"/g, '\\"')}"`,
        { cwd: CONFIG_REPO_PATH }
      );
      
      // Get new commit info
      const { stdout: shaOutput } = await execAsync('git rev-parse HEAD', { cwd: CONFIG_REPO_PATH });
      const sha = shaOutput.trim();
      
      res.json({
        message: 'Changes committed successfully',
        sha,
        details: stdout
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to commit', details: error.message });
    }
  });
  
  // Push to remote
  router.post('/push', async (req: Request, res: Response) => {
    try {
      const { remote, branch, force } = req.body;
      
      const remoteName = remote || 'origin';
      const branchName = branch || 'main';
      const forceFlag = force ? '--force' : '';
      
      const { stdout } = await execAsync(
        `git push ${forceFlag} ${remoteName} ${branchName}`,
        { cwd: CONFIG_REPO_PATH }
      );
      
      res.json({ message: 'Pushed successfully', details: stdout });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to push', details: error.message });
    }
  });
  
  // Pull from remote
  router.post('/pull', async (req: Request, res: Response) => {
    try {
      const { remote, branch } = req.body;
      
      const remoteName = remote || 'origin';
      const branchName = branch || 'main';
      
      const { stdout } = await execAsync(
        `git pull ${remoteName} ${branchName}`,
        { cwd: CONFIG_REPO_PATH }
      );
      
      res.json({ message: 'Pulled successfully', details: stdout });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to pull', details: error.message });
    }
  });
  
  // Rollback to specific commit
  router.post('/rollback/:sha', async (req: Request, res: Response) => {
    try {
      const { sha } = req.params;
      const { hard } = req.body;
      
      // Verify commit exists
      try {
        await execAsync(`git cat-file -t ${sha}`, { cwd: CONFIG_REPO_PATH });
      } catch {
        return res.status(404).json({ error: 'Commit not found' });
      }
      
      if (hard) {
        // Hard reset - discards all changes
        await execAsync(`git reset --hard ${sha}`, { cwd: CONFIG_REPO_PATH });
      } else {
        // Soft rollback - creates a new commit that undoes changes
        await execAsync(`git revert --no-commit ${sha}..HEAD`, { cwd: CONFIG_REPO_PATH });
        await execAsync(`git commit -m "Rollback to ${sha.substring(0, 7)}"`, { cwd: CONFIG_REPO_PATH });
      }
      
      res.json({ message: `Rolled back to ${sha}`, hard: !!hard });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to rollback', details: error.message });
    }
  });
  
  // Get diff for a commit
  router.get('/diff/:sha', async (req: Request, res: Response) => {
    try {
      const { sha } = req.params;
      
      const { stdout } = await execAsync(
        `git show --format="" --stat --patch ${sha}`,
        { cwd: CONFIG_REPO_PATH }
      );
      
      const diffs = parseDiff(stdout);
      res.json({ sha, diffs });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to get diff', details: error.message });
    }
  });
  
  // Get diff between two commits
  router.get('/diff/:fromSha/:toSha', async (req: Request, res: Response) => {
    try {
      const { fromSha, toSha } = req.params;
      
      const { stdout } = await execAsync(
        `git diff ${fromSha}..${toSha}`,
        { cwd: CONFIG_REPO_PATH }
      );
      
      const diffs = parseDiff(stdout);
      res.json({ from: fromSha, to: toSha, diffs });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to get diff', details: error.message });
    }
  });
  
  // List files in repository
  router.get('/files', async (req: Request, res: Response) => {
    try {
      const dir = req.query.dir as string || '';
      const targetPath = path.join(CONFIG_REPO_PATH, dir);
      
      if (!targetPath.startsWith(CONFIG_REPO_PATH)) {
        return res.status(400).json({ error: 'Invalid path' });
      }
      
      const files = listFilesRecursive(targetPath, CONFIG_REPO_PATH);
      res.json({ files });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to list files', details: error.message });
    }
  });
  
  // Get file content
  router.get('/files/*', async (req: Request, res: Response) => {
    try {
      const filePath = req.params[0];
      const fullPath = path.join(CONFIG_REPO_PATH, filePath);
      
      if (!fullPath.startsWith(CONFIG_REPO_PATH)) {
        return res.status(400).json({ error: 'Invalid path' });
      }
      
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      const content = fs.readFileSync(fullPath, 'utf-8');
      const stat = fs.statSync(fullPath);
      
      res.json({
        path: filePath,
        content,
        size: stat.size,
        modified: stat.mtime
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to get file', details: error.message });
    }
  });
  
  // Update file content
  router.put('/files/*', async (req: Request, res: Response) => {
    try {
      const filePath = req.params[0];
      const { content, commit, message } = req.body;
      const fullPath = path.join(CONFIG_REPO_PATH, filePath);
      
      if (!fullPath.startsWith(CONFIG_REPO_PATH)) {
        return res.status(400).json({ error: 'Invalid path' });
      }
      
      // Ensure parent directory exists
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Write file
      fs.writeFileSync(fullPath, content);
      
      // Auto-commit if requested
      if (commit) {
        const commitMessage = message || `Update ${filePath}`;
        await execAsync(`git add "${filePath}"`, { cwd: CONFIG_REPO_PATH });
        await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { cwd: CONFIG_REPO_PATH });
      }
      
      res.json({
        path: filePath,
        message: commit ? 'File updated and committed' : 'File updated'
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to update file', details: error.message });
    }
  });
  
  // Delete file
  router.delete('/files/*', async (req: Request, res: Response) => {
    try {
      const filePath = req.params[0];
      const { commit, message } = req.body;
      const fullPath = path.join(CONFIG_REPO_PATH, filePath);
      
      if (!fullPath.startsWith(CONFIG_REPO_PATH)) {
        return res.status(400).json({ error: 'Invalid path' });
      }
      
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      fs.unlinkSync(fullPath);
      
      if (commit) {
        const commitMessage = message || `Delete ${filePath}`;
        await execAsync(`git add "${filePath}"`, { cwd: CONFIG_REPO_PATH });
        await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { cwd: CONFIG_REPO_PATH });
      }
      
      res.json({
        path: filePath,
        message: commit ? 'File deleted and committed' : 'File deleted'
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to delete file', details: error.message });
    }
  });
  
  // List branches
  router.get('/branches', async (_req: Request, res: Response) => {
    try {
      const { stdout } = await execAsync('git branch -a', { cwd: CONFIG_REPO_PATH });
      
      const branches = stdout.trim().split('\n')
        .map(b => b.trim())
        .filter(b => b)
        .map(b => ({
          name: b.replace(/^\*\s*/, '').replace('remotes/origin/', ''),
          current: b.startsWith('*'),
          remote: b.includes('remotes/')
        }));
      
      res.json({ branches });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to list branches', details: error.message });
    }
  });
  
  // Create/switch branch
  router.post('/branches', async (req: Request, res: Response) => {
    try {
      const { name, from, checkout } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Branch name is required' });
      }
      
      // Create branch
      const createFrom = from || 'HEAD';
      await execAsync(`git branch ${name} ${createFrom}`, { cwd: CONFIG_REPO_PATH });
      
      // Checkout if requested
      if (checkout) {
        await execAsync(`git checkout ${name}`, { cwd: CONFIG_REPO_PATH });
      }
      
      res.json({ message: `Branch ${name} created`, checkout: !!checkout });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to create branch', details: error.message });
    }
  });
  
  return router;
}

// Helper functions

async function getGitStatus(): Promise<GitStatus> {
  try {
    const gitDir = path.join(CONFIG_REPO_PATH, '.git');
    if (!fs.existsSync(gitDir)) {
      return {
        initialized: false,
        branch: '',
        clean: true,
        staged: [],
        modified: [],
        untracked: [],
        ahead: 0,
        behind: 0
      };
    }
    
    // Get current branch
    const { stdout: branchOutput } = await execAsync(
      'git rev-parse --abbrev-ref HEAD',
      { cwd: CONFIG_REPO_PATH }
    );
    const branch = branchOutput.trim();
    
    // Get status
    const { stdout: statusOutput } = await execAsync(
      'git status --porcelain',
      { cwd: CONFIG_REPO_PATH }
    );
    
    const staged: string[] = [];
    const modified: string[] = [];
    const untracked: string[] = [];
    
    for (const line of statusOutput.trim().split('\n').filter(l => l)) {
      const status = line.substring(0, 2);
      const file = line.substring(3);
      
      if (status[0] !== ' ' && status[0] !== '?') staged.push(file);
      if (status[1] === 'M' || status[1] === 'D') modified.push(file);
      if (status === '??') untracked.push(file);
    }
    
    // Get remote tracking
    let ahead = 0;
    let behind = 0;
    let remoteUrl: string | undefined;
    
    try {
      const { stdout: remote } = await execAsync(
        'git remote get-url origin',
        { cwd: CONFIG_REPO_PATH }
      );
      remoteUrl = remote.trim();
      
      const { stdout: tracking } = await execAsync(
        `git rev-list --left-right --count origin/${branch}...HEAD`,
        { cwd: CONFIG_REPO_PATH }
      );
      const [b, a] = tracking.trim().split('\t').map(n => parseInt(n, 10));
      behind = b;
      ahead = a;
    } catch {}
    
    return {
      initialized: true,
      branch,
      clean: staged.length === 0 && modified.length === 0 && untracked.length === 0,
      staged,
      modified,
      untracked,
      ahead,
      behind,
      remoteUrl
    };
  } catch (error) {
    return {
      initialized: false,
      branch: '',
      clean: true,
      staged: [],
      modified: [],
      untracked: [],
      ahead: 0,
      behind: 0
    };
  }
}

function parseDiff(diffOutput: string): GitDiff[] {
  const diffs: GitDiff[] = [];
  const fileBlocks = diffOutput.split(/^diff --git/m).filter(b => b.trim());
  
  for (const block of fileBlocks) {
    const lines = block.split('\n');
    const fileMatch = lines[0]?.match(/a\/(.+?) b\//);
    if (!fileMatch) continue;
    
    const file = fileMatch[1];
    let added = 0;
    let removed = 0;
    const hunks: { header: string; lines: string[] }[] = [];
    let currentHunk: { header: string; lines: string[] } | null = null;
    
    for (const line of lines) {
      if (line.startsWith('@@')) {
        if (currentHunk) hunks.push(currentHunk);
        currentHunk = { header: line, lines: [] };
      } else if (currentHunk) {
        currentHunk.lines.push(line);
        if (line.startsWith('+') && !line.startsWith('+++')) added++;
        if (line.startsWith('-') && !line.startsWith('---')) removed++;
      }
    }
    
    if (currentHunk) hunks.push(currentHunk);
    
    diffs.push({
      file,
      changes: { added, removed },
      hunks
    });
  }
  
  return diffs;
}

function listFilesRecursive(dir: string, basePath: string): { path: string; type: 'file' | 'directory'; size?: number }[] {
  const results: { path: string; type: 'file' | 'directory'; size?: number }[] = [];
  
  if (!fs.existsSync(dir)) return results;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.name === '.git') continue;
    
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(basePath, fullPath);
    
    if (entry.isDirectory()) {
      results.push({ path: relativePath, type: 'directory' });
      results.push(...listFilesRecursive(fullPath, basePath));
    } else {
      const stat = fs.statSync(fullPath);
      results.push({ path: relativePath, type: 'file', size: stat.size });
    }
  }
  
  return results;
}

function createSampleConfigs(): void {
  // Sample source config
  const sampleSource = `# Example Confluence Integration
name: "Internal Confluence"
description: "Company internal documentation"
template: "confluence"
enabled: false

auth:
  base_url: "https://yourcompany.atlassian.net/wiki"
  username: "\${CONFLUENCE_USERNAME}"
  api_token: "\${CONFLUENCE_API_TOKEN}"

filters:
  spaces:
    - "DOCS"
    - "WIKI"

schedule:
  type: "interval"
  interval_minutes: 60
`;
  
  fs.writeFileSync(path.join(CONFIG_REPO_PATH, 'sources', 'example-confluence.yaml'), sampleSource);
  
  // Sample ontology
  const sampleOntology = `# Ontology Terms
# Define hierarchical term relationships

terms:
  - term: "Technology"
    children:
      - term: "Programming Languages"
        synonyms: ["coding languages", "dev languages"]
        children:
          - term: "Python"
            synonyms: ["py"]
          - term: "JavaScript"
            synonyms: ["JS", "ECMAScript"]
          - term: "TypeScript"
            synonyms: ["TS"]
      - term: "Databases"
        synonyms: ["DB", "data stores"]
        children:
          - term: "SQL Databases"
            children:
              - term: "PostgreSQL"
                synonyms: ["Postgres", "PG"]
              - term: "MySQL"
          - term: "NoSQL Databases"
            children:
              - term: "MongoDB"
                synonyms: ["Mongo"]
              - term: "Redis"
`;
  
  fs.writeFileSync(path.join(CONFIG_REPO_PATH, 'ontology', 'terms.yaml'), sampleOntology);
  
  // Sample dictionary
  const sampleDictionary = `# Dictionary - Synonyms and Acronyms
# Helps expand search queries

entries:
  - term: "API"
    acronym_for: "Application Programming Interface"
    synonyms: ["web service", "endpoint"]
    domain: "technology"
  
  - term: "K8s"
    acronym_for: "Kubernetes"
    synonyms: ["kube"]
    domain: "devops"
  
  - term: "CI/CD"
    acronym_for: "Continuous Integration / Continuous Deployment"
    synonyms: ["pipeline", "build automation"]
    domain: "devops"
`;
  
  fs.writeFileSync(path.join(CONFIG_REPO_PATH, 'dictionary', 'synonyms.yaml'), sampleDictionary);
  
  // Sample triggers
  const sampleTriggers = `# Search Triggers
# Define rules that modify search behavior

triggers:
  - name: "Error Boost"
    description: "Boost troubleshooting docs for error-related queries"
    pattern: "(error|exception|fail|crash)"
    priority: 10
    actions:
      boost_doc_type: "troubleshooting"
      inject_terms:
        - "solution"
        - "fix"
  
  - name: "API Docs"
    description: "Prioritize API documentation for API queries"
    pattern: "(api|endpoint|rest|graphql)"
    priority: 5
    actions:
      boost_doc_type: "api-reference"
`;
  
  fs.writeFileSync(path.join(CONFIG_REPO_PATH, 'triggers', 'search-rules.yaml'), sampleTriggers);
  
  // Sample webhooks config
  const sampleWebhooks = `# Webhook Notifications
# Configure outbound webhooks for events

webhooks:
  - name: "Slack Notifications"
    url: "\${SLACK_WEBHOOK_URL}"
    enabled: false
    events:
      - "document.indexed"
      - "search.performed"
    filters:
      min_results: 0
    template: |
      {
        "text": "Beacon Search: {{event}} - {{details}}"
      }
  
  - name: "Monitoring"
    url: "\${MONITORING_WEBHOOK_URL}"
    enabled: false
    events:
      - "connector.completed"
      - "connector.failed"
`;
  
  fs.writeFileSync(path.join(CONFIG_REPO_PATH, 'webhooks', 'notifications.yaml'), sampleWebhooks);
}
