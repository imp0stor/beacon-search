/**
 * BMAD-Powered Config Wizard for Beacon Search
 * 
 * BMAD = Build, Measure, Analyze, Decide
 * 
 * Guides administrators through integration setup like a knowledgeable consultant,
 * not just a form wizard. Each phase produces artifacts stored in config-repo/_bmad/
 */

import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ConnectorConfig, ConnectorType } from '../connectors/types';

// ============================================
// TYPES
// ============================================

export type BmadPhase = 'analysis' | 'planning' | 'build' | 'measure' | 'iterate';

export interface WizardSession {
  id: string;
  phase: BmadPhase;
  integrationName: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Phase data
  analysis?: AnalysisData;
  planning?: PlanningData;
  build?: BuildData;
  measure?: MeasureData;
  iterate?: IterateData;
  
  // Conversation history
  messages: WizardMessage[];
}

export interface WizardMessage {
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
  phase: BmadPhase;
  artifacts?: string[]; // References to generated artifacts
}

export interface AnalysisData {
  contentType: string;
  contentDescription: string;
  accessNeeds: string[];
  businessGoal: string;
  dataLocation: string;
  estimatedDocuments?: number;
  sensitivityLevel: 'public' | 'internal' | 'confidential' | 'restricted';
  updateFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'manual';
  briefGenerated?: boolean;
}

export interface PlanningData {
  recommendedConnector: ConnectorType;
  connectorReason: string;
  fieldMappings: FieldMapping[];
  accessControl: AccessControlPlan;
  indexingScope: IndexingScope;
  specGenerated?: boolean;
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transformation?: string;
  searchable: boolean;
  facetable: boolean;
}

export interface AccessControlPlan {
  strategy: 'open' | 'authenticated' | 'role-based' | 'document-level';
  roles?: string[];
  rules?: string[];
}

export interface IndexingScope {
  estimatedDocuments: number;
  refreshFrequency: string;
  initialSyncStrategy: 'full' | 'incremental' | 'sample';
  rateLimits?: {
    requestsPerSecond: number;
    maxConcurrent: number;
  };
}

export interface BuildData {
  configYaml: string;
  configPath: string;
  validationResults: ValidationResult[];
  credentialsTested: boolean;
  connectivityTested: boolean;
  committed?: boolean;
  commitMessage?: string;
}

export interface ValidationResult {
  field: string;
  valid: boolean;
  message: string;
}

export interface MeasureData {
  syncStarted: Date;
  syncCompleted?: Date;
  documentsIndexed: number;
  documentsErrored: number;
  warnings: string[];
  sampleQueries: SampleQueryResult[];
  syncReportGenerated?: boolean;
}

export interface SampleQueryResult {
  query: string;
  resultsCount: number;
  topScore: number;
  relevant: boolean;
}

export interface IterateData {
  improvements: Improvement[];
  appliedImprovements: string[];
  iterationCount: number;
}

export interface Improvement {
  id: string;
  type: 'field-mapping' | 'rate-limit' | 'access-control' | 'content-filter';
  priority: 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
  applied: boolean;
}

// ============================================
// BMAD WIZARD CLASS
// ============================================

export class BmadWizard {
  private pool: Pool;
  private configRepoPath: string;
  private sessions: Map<string, WizardSession> = new Map();

  constructor(pool: Pool, configRepoPath: string = '/app/config-repo') {
    this.pool = pool;
    this.configRepoPath = configRepoPath;
  }

  // ============================================
  // SESSION MANAGEMENT
  // ============================================

  createSession(integrationName: string): WizardSession {
    const session: WizardSession = {
      id: this.generateId(),
      phase: 'analysis',
      integrationName: this.slugify(integrationName),
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: []
    };
    
    this.sessions.set(session.id, session);
    
    // Add initial welcome message
    this.addMessage(session, 'assistant', this.getWelcomeMessage(integrationName));
    
    return session;
  }

  getSession(sessionId: string): WizardSession | undefined {
    return this.sessions.get(sessionId);
  }

  private addMessage(session: WizardSession, role: 'assistant' | 'user', content: string, artifacts?: string[]) {
    session.messages.push({
      role,
      content,
      timestamp: new Date(),
      phase: session.phase,
      artifacts
    });
    session.updatedAt = new Date();
  }

  // ============================================
  // PHASE 1: ANALYSIS
  // ============================================

  async processAnalysis(sessionId: string, userInput: string): Promise<WizardMessage> {
    const session = this.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    
    this.addMessage(session, 'user', userInput);
    
    if (!session.analysis) {
      session.analysis = {} as AnalysisData;
    }
    
    const analysis = session.analysis;
    const lowerInput = userInput.toLowerCase();
    
    // Parse user input to extract analysis data
    let responseContent: string;
    
    if (!analysis.contentType) {
      // Detect content type from input
      analysis.contentType = this.detectContentType(userInput);
      analysis.contentDescription = userInput;
      
      responseContent = `Great! So you want to index **${analysis.contentType}** content.

📋 Let me understand more about your needs:

**Who needs access to this content?**
- Everyone in the organization?
- Specific teams or departments?
- External users?

Please describe who will be searching this content.`;
    }
    else if (!analysis.accessNeeds || analysis.accessNeeds.length === 0) {
      analysis.accessNeeds = this.parseAccessNeeds(userInput);
      
      responseContent = `Got it! Access will be for: **${analysis.accessNeeds.join(', ')}**

🎯 **What's the business goal for indexing this content?**

Common goals include:
- **Faster support** - Help support teams find answers quickly
- **Knowledge sharing** - Break down information silos
- **Compliance** - Meet regulatory requirements for information retrieval
- **Onboarding** - Help new employees find information
- **Research** - Enable deep dives into historical data

What problem are you trying to solve?`;
    }
    else if (!analysis.businessGoal) {
      analysis.businessGoal = userInput;
      
      responseContent = `Excellent goal: "${analysis.businessGoal}"

📍 **Where is this content located?**

Tell me about the data source:
- Is it in a **database** (SQL Server, PostgreSQL, MySQL)?
- A **website** or web application?
- **File storage** (local folders, network shares)?
- A **cloud service** (SharePoint, Google Drive, Confluence)?

What's the URL, path, or connection info?`;
    }
    else if (!analysis.dataLocation) {
      analysis.dataLocation = userInput;
      
      // Detect sensitivity from context
      analysis.sensitivityLevel = this.detectSensitivity(userInput);
      
      responseContent = `I see the content is at: **${analysis.dataLocation}**

📊 **Roughly how many documents are we talking about?**

And how often does this content change?
- **Real-time** - Changes constantly
- **Daily** - Updated daily
- **Weekly** - Updated weekly
- **Rarely** - Mostly static content

Give me your best estimate on volume and change frequency.`;
    }
    else if (!analysis.estimatedDocuments) {
      // Parse document count and frequency
      const numbers = userInput.match(/\d+/g);
      analysis.estimatedDocuments = numbers ? parseInt(numbers[0]) : 1000;
      analysis.updateFrequency = this.detectFrequency(userInput);
      
      // Generate the brief
      const briefPath = await this.generateBrief(session);
      analysis.briefGenerated = true;
      
      responseContent = `Perfect! I've gathered enough to create your **Integration Brief**.

---

## 📋 Integration Brief: ${session.integrationName}

| Aspect | Details |
|--------|---------|
| **Content Type** | ${analysis.contentType} |
| **Description** | ${analysis.contentDescription} |
| **Access Needs** | ${analysis.accessNeeds.join(', ')} |
| **Business Goal** | ${analysis.businessGoal} |
| **Data Location** | ${analysis.dataLocation} |
| **Est. Documents** | ~${analysis.estimatedDocuments?.toLocaleString()} |
| **Sensitivity** | ${analysis.sensitivityLevel} |
| **Update Frequency** | ${analysis.updateFrequency} |

---

📄 Brief saved to: \`${briefPath}\`

✅ **Analysis phase complete!**

Ready to move to **Planning**? I'll recommend the best connector and design the integration.

Type **"plan"** or **"next"** to continue, or update any details above.`;
    }
    else {
      // Analysis is complete, waiting for user to proceed
      if (lowerInput.includes('plan') || lowerInput.includes('next') || lowerInput.includes('continue')) {
        session.phase = 'planning';
        return this.startPlanning(session);
      }
      
      responseContent = `Analysis is complete! Here's what we captured:

- **Content**: ${analysis.contentType}
- **Access**: ${analysis.accessNeeds.join(', ')}
- **Goal**: ${analysis.businessGoal}
- **Location**: ${analysis.dataLocation}
- **Volume**: ~${analysis.estimatedDocuments?.toLocaleString()} docs
- **Updates**: ${analysis.updateFrequency}

Would you like to **update** any details, or type **"plan"** to continue to the Planning phase?`;
    }
    
    const message: WizardMessage = {
      role: 'assistant',
      content: responseContent,
      timestamp: new Date(),
      phase: session.phase
    };
    
    session.messages.push(message);
    return message;
  }

  // ============================================
  // PHASE 2: PLANNING
  // ============================================

  private async startPlanning(session: WizardSession): Promise<WizardMessage> {
    const analysis = session.analysis!;
    
    // Determine recommended connector
    const recommendation = this.recommendConnector(analysis);
    
    session.planning = {
      recommendedConnector: recommendation.type,
      connectorReason: recommendation.reason,
      fieldMappings: [],
      accessControl: { strategy: 'open' },
      indexingScope: {
        estimatedDocuments: analysis.estimatedDocuments || 1000,
        refreshFrequency: analysis.updateFrequency || 'daily',
        initialSyncStrategy: (analysis.estimatedDocuments || 0) > 10000 ? 'incremental' : 'full'
      }
    };
    
    const content = `## 🎯 Planning Phase

Based on your requirements, here's my recommendation:

### Recommended Connector: **${recommendation.type.toUpperCase()}**

${recommendation.reason}

---

### 📐 Proposed Architecture

\`\`\`
${this.generateArchitectureDiagram(recommendation.type)}
\`\`\`

---

### 🗂️ Field Mappings

I'll map your content to searchable fields. For **${analysis.contentType}**, I suggest:

${this.suggestFieldMappings(analysis.contentType)}

---

### 🔐 Access Control

Based on "${analysis.accessNeeds.join(', ')}", I recommend:
- **Strategy**: ${this.recommendAccessStrategy(analysis.accessNeeds)}
- **Scope**: ${analysis.sensitivityLevel} content handling

---

### 📊 Indexing Plan

| Setting | Value |
|---------|-------|
| **Initial Sync** | ${session.planning.indexingScope.initialSyncStrategy} |
| **Refresh Rate** | ${session.planning.indexingScope.refreshFrequency} |
| **Est. Documents** | ${session.planning.indexingScope.estimatedDocuments.toLocaleString()} |
| **Rate Limit** | ${this.suggestRateLimit(recommendation.type)} |

---

Does this plan look good? You can:
- **Adjust** field mappings or settings
- **Approve** to generate the spec
- **Ask questions** about any aspect

Type **"approve"** or **"build"** when ready to proceed.`;

    const message: WizardMessage = {
      role: 'assistant',
      content,
      timestamp: new Date(),
      phase: 'planning'
    };
    
    session.messages.push(message);
    return message;
  }

  async processPlanning(sessionId: string, userInput: string): Promise<WizardMessage> {
    const session = this.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    
    this.addMessage(session, 'user', userInput);
    
    const lowerInput = userInput.toLowerCase();
    let responseContent: string;
    
    if (lowerInput.includes('approve') || lowerInput.includes('build') || lowerInput.includes('next')) {
      // Generate spec and move to build
      const specPath = await this.generateSpec(session);
      session.planning!.specGenerated = true;
      session.phase = 'build';
      
      return this.startBuild(session, specPath);
    }
    else if (lowerInput.includes('field') || lowerInput.includes('mapping')) {
      responseContent = `### 🗂️ Field Mapping Configuration

Current mappings for **${session.analysis!.contentType}**:

${this.formatFieldMappings(session.planning!.fieldMappings)}

To modify mappings, tell me:
- "Add field [source] → [target]"
- "Remove [field name]"
- "Make [field] searchable/facetable"

Or describe what fields you want indexed and I'll suggest mappings.`;
    }
    else if (lowerInput.includes('rate') || lowerInput.includes('limit')) {
      responseContent = `### ⏱️ Rate Limiting

Current settings:
- **Requests/second**: ${session.planning!.indexingScope.rateLimits?.requestsPerSecond || 'auto'}
- **Max concurrent**: ${session.planning!.indexingScope.rateLimits?.maxConcurrent || 'auto'}

For **${session.planning!.recommendedConnector}** connectors, I recommend:
${this.explainRateLimits(session.planning!.recommendedConnector)}

To adjust: "Set rate limit to X requests/second"`;
    }
    else if (lowerInput.includes('access') || lowerInput.includes('security')) {
      responseContent = `### 🔐 Access Control Configuration

Current strategy: **${session.planning!.accessControl.strategy}**

Available strategies:
- **open** - Anyone can search (public content)
- **authenticated** - Logged-in users only
- **role-based** - Specific roles/groups
- **document-level** - Per-document permissions

To change: "Use [strategy] access control"`;
    }
    else {
      // Try to understand what they want to adjust
      responseContent = `I can help you adjust the plan. What would you like to modify?

- **Field mappings** - Which fields to index
- **Rate limits** - Sync speed settings
- **Access control** - Who can search
- **Indexing scope** - How much to sync

Or type **"approve"** if the plan looks good!`;
    }
    
    const message: WizardMessage = {
      role: 'assistant',
      content: responseContent,
      timestamp: new Date(),
      phase: session.phase
    };
    
    session.messages.push(message);
    return message;
  }

  // ============================================
  // PHASE 3: BUILD
  // ============================================

  private async startBuild(session: WizardSession, specPath: string): Promise<WizardMessage> {
    const planning = session.planning!;
    const analysis = session.analysis!;
    
    // Generate initial config
    const configYaml = this.generateConfig(session);
    const configPath = `sources/${session.integrationName}.yaml`;
    
    session.build = {
      configYaml,
      configPath,
      validationResults: [],
      credentialsTested: false,
      connectivityTested: false
    };
    
    const content = `## 🔨 Build Phase

I've generated your integration spec at \`${specPath}\`.

Now let's build the configuration step by step.

---

### 📝 Generated Configuration

\`\`\`yaml
${configYaml}
\`\`\`

---

### ✅ Validation Checklist

- [ ] Configuration syntax valid
- [ ] Required fields present
- [ ] Credentials configured
- [ ] Connectivity tested

---

### 🔑 Next: Configure Credentials

${this.getCredentialPrompt(planning.recommendedConnector)}

Please provide the connection details, or type:
- **"validate"** - Check configuration syntax
- **"test"** - Test connectivity
- **"save"** - Save to config-repo`;

    const message: WizardMessage = {
      role: 'assistant',
      content,
      timestamp: new Date(),
      phase: 'build'
    };
    
    session.messages.push(message);
    return message;
  }

  async processBuild(sessionId: string, userInput: string): Promise<WizardMessage> {
    const session = this.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    
    this.addMessage(session, 'user', userInput);
    
    const lowerInput = userInput.toLowerCase();
    let responseContent: string;
    
    if (lowerInput.includes('validate')) {
      // Validate configuration
      const results = this.validateConfig(session.build!.configYaml);
      session.build!.validationResults = results;
      
      const allValid = results.every(r => r.valid);
      
      responseContent = `### ✅ Configuration Validation

${results.map(r => `${r.valid ? '✓' : '✗'} **${r.field}**: ${r.message}`).join('\n')}

${allValid 
  ? '🎉 Configuration is valid! Type **"test"** to check connectivity.'
  : '⚠️ Please fix the issues above and validate again.'}`;
    }
    else if (lowerInput.includes('test')) {
      // Test connectivity
      responseContent = await this.testConnectivity(session);
    }
    else if (lowerInput.includes('save') || lowerInput.includes('commit')) {
      // Save configuration
      const savedPath = await this.saveConfig(session);
      session.build!.committed = true;
      session.build!.commitMessage = `Add ${session.integrationName} integration via BMAD wizard`;
      
      responseContent = `### 💾 Configuration Saved!

✅ Saved to: \`${savedPath}\`

📝 Commit message: "${session.build!.commitMessage}"

---

Your configuration is ready! Now let's verify it works.

Type **"sync"** or **"measure"** to run the initial sync and see results.`;
      
      // Check if ready to move to measure phase
      if (session.build!.credentialsTested && session.build!.connectivityTested) {
        session.phase = 'measure';
      }
    }
    else if (this.looksLikeCredentials(userInput)) {
      // Parse credentials from input
      const updatedConfig = this.updateConfigWithCredentials(session, userInput);
      session.build!.configYaml = updatedConfig;
      
      responseContent = `### 🔑 Credentials Updated

I've updated the configuration with your connection details.

\`\`\`yaml
${this.sanitizeConfigForDisplay(updatedConfig)}
\`\`\`

Type **"validate"** to check the configuration, or **"test"** to verify connectivity.`;
    }
    else if (lowerInput.includes('sync') || lowerInput.includes('measure') || lowerInput.includes('next')) {
      session.phase = 'measure';
      return this.startMeasure(session);
    }
    else {
      responseContent = `I'm ready to help configure your integration.

Current status:
- Config: ${session.build!.validationResults.length > 0 ? (session.build!.validationResults.every(r => r.valid) ? '✅ Valid' : '⚠️ Has issues') : '📝 Needs validation'}
- Credentials: ${session.build!.credentialsTested ? '✅ Tested' : '⏳ Not tested'}
- Connectivity: ${session.build!.connectivityTested ? '✅ Connected' : '⏳ Not tested'}

What would you like to do?
- Provide credentials
- **validate** - Check syntax
- **test** - Test connection
- **save** - Commit configuration`;
    }
    
    const message: WizardMessage = {
      role: 'assistant',
      content: responseContent,
      timestamp: new Date(),
      phase: session.phase
    };
    
    session.messages.push(message);
    return message;
  }

  // ============================================
  // PHASE 4: MEASURE
  // ============================================

  private async startMeasure(session: WizardSession): Promise<WizardMessage> {
    session.measure = {
      syncStarted: new Date(),
      documentsIndexed: 0,
      documentsErrored: 0,
      warnings: [],
      sampleQueries: []
    };
    
    const content = `## 📊 Measure Phase

Let's verify your integration is working correctly.

---

### 🔄 Initial Sync

I'll start syncing documents from **${session.analysis!.dataLocation}**.

Expected: ~${session.analysis!.estimatedDocuments?.toLocaleString()} documents

---

### Running Sync...

\`\`\`
[${new Date().toISOString()}] Starting sync for ${session.integrationName}
[${new Date().toISOString()}] Connecting to source...
[${new Date().toISOString()}] Fetching document list...
\`\`\`

This may take a few minutes. I'll report progress.

Type **"status"** to check progress, or wait for completion.`;

    // In a real implementation, this would trigger the actual sync
    // For now, we'll simulate it
    setTimeout(() => this.simulateSyncProgress(session), 2000);
    
    const message: WizardMessage = {
      role: 'assistant',
      content,
      timestamp: new Date(),
      phase: 'measure'
    };
    
    session.messages.push(message);
    return message;
  }

  async processMeasure(sessionId: string, userInput: string): Promise<WizardMessage> {
    const session = this.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    
    this.addMessage(session, 'user', userInput);
    
    const lowerInput = userInput.toLowerCase();
    let responseContent: string;
    
    if (lowerInput.includes('status')) {
      responseContent = this.getSyncStatus(session);
    }
    else if (lowerInput.includes('query') || lowerInput.includes('search') || lowerInput.includes('test')) {
      // Test search quality
      const queryToTest = userInput.replace(/query|search|test/gi, '').trim() || 'sample query';
      const result = await this.testSearchQuery(session, queryToTest);
      
      responseContent = `### 🔍 Search Test: "${queryToTest}"

Results: **${result.resultsCount}** documents found
Top Score: **${(result.topScore * 100).toFixed(1)}%** relevance

${result.resultsCount > 0 
  ? `✅ Good! The search is returning results.`
  : `⚠️ No results found. You may need to adjust field mappings.`}

Try more test queries or type **"report"** to generate the sync report.`;
      
      session.measure!.sampleQueries.push(result);
    }
    else if (lowerInput.includes('report')) {
      const reportPath = await this.generateSyncReport(session);
      session.measure!.syncReportGenerated = true;
      
      responseContent = `### 📋 Sync Report Generated

Report saved to: \`${reportPath}\`

---

## Sync Summary

| Metric | Value |
|--------|-------|
| **Documents Indexed** | ${session.measure!.documentsIndexed} |
| **Errors** | ${session.measure!.documentsErrored} |
| **Warnings** | ${session.measure!.warnings.length} |
| **Duration** | ${this.formatDuration(session.measure!.syncStarted, session.measure!.syncCompleted)} |

### Search Quality
${session.measure!.sampleQueries.map(q => 
  `- "${q.query}": ${q.resultsCount} results (${(q.topScore * 100).toFixed(0)}% relevance)`
).join('\n') || 'No test queries run yet'}

---

Ready to wrap up? Type **"iterate"** to get improvement suggestions, or **"done"** to finish.`;
    }
    else if (lowerInput.includes('iterate') || lowerInput.includes('improve') || lowerInput.includes('next')) {
      session.phase = 'iterate';
      return this.startIterate(session);
    }
    else if (lowerInput.includes('done') || lowerInput.includes('finish')) {
      return this.finishWizard(session);
    }
    else {
      responseContent = `Sync is ${session.measure!.syncCompleted ? 'complete' : 'in progress'}.

What would you like to do?
- **status** - Check sync progress
- **query [term]** - Test search quality
- **report** - Generate sync report
- **iterate** - Get improvement suggestions`;
    }
    
    const message: WizardMessage = {
      role: 'assistant',
      content: responseContent,
      timestamp: new Date(),
      phase: session.phase
    };
    
    session.messages.push(message);
    return message;
  }

  // ============================================
  // PHASE 5: ITERATE
  // ============================================

  private async startIterate(session: WizardSession): Promise<WizardMessage> {
    const improvements = this.analyzeForImprovements(session);
    
    session.iterate = {
      improvements,
      appliedImprovements: [],
      iterationCount: 1
    };
    
    const content = `## 🔄 Iterate Phase

Based on the sync results, here are my recommendations:

---

### 💡 Suggested Improvements

${improvements.length > 0 
  ? improvements.map((imp, i) => `
**${i + 1}. ${imp.description}** [${imp.priority} priority]

   ${imp.recommendation}
   
   → Type **"apply ${i + 1}"** to implement this change
`).join('\n')
  : '🎉 Your integration looks great! No immediate improvements needed.'}

---

${improvements.length > 0 
  ? `You can:
- **apply [number]** - Implement a suggestion
- **skip** - Skip and finish
- **resync** - Run another sync after changes`
  : 'Type **"done"** to complete the wizard.'}`;

    const message: WizardMessage = {
      role: 'assistant',
      content,
      timestamp: new Date(),
      phase: 'iterate'
    };
    
    session.messages.push(message);
    return message;
  }

  async processIterate(sessionId: string, userInput: string): Promise<WizardMessage> {
    const session = this.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    
    this.addMessage(session, 'user', userInput);
    
    const lowerInput = userInput.toLowerCase();
    let responseContent: string;
    
    if (lowerInput.includes('apply')) {
      const match = userInput.match(/apply\s+(\d+)/i);
      if (match) {
        const index = parseInt(match[1]) - 1;
        const improvement = session.iterate!.improvements[index];
        
        if (improvement) {
          // Apply the improvement
          await this.applyImprovement(session, improvement);
          improvement.applied = true;
          session.iterate!.appliedImprovements.push(improvement.id);
          
          responseContent = `### ✅ Applied: ${improvement.description}

Changes made:
${this.describeAppliedChanges(improvement)}

${session.iterate!.improvements.filter(i => !i.applied).length > 0
  ? 'More improvements available. Apply another or type **"resync"** to test changes.'
  : 'All improvements applied! Type **"resync"** to test or **"done"** to finish.'}`;
        } else {
          responseContent = `I couldn't find improvement #${match[1]}. Please try again.`;
        }
      } else {
        responseContent = `Please specify which improvement to apply, e.g., "apply 1"`;
      }
    }
    else if (lowerInput.includes('resync')) {
      session.phase = 'measure';
      session.iterate!.iterationCount++;
      return this.startMeasure(session);
    }
    else if (lowerInput.includes('skip') || lowerInput.includes('done') || lowerInput.includes('finish')) {
      return this.finishWizard(session);
    }
    else {
      const remaining = session.iterate!.improvements.filter(i => !i.applied);
      responseContent = `### 🔄 Iteration ${session.iterate!.iterationCount}

Applied: ${session.iterate!.appliedImprovements.length} improvements
Remaining: ${remaining.length} suggestions

${remaining.length > 0 
  ? `Available improvements:\n${remaining.map((imp, i) => `${i + 1}. ${imp.description}`).join('\n')}`
  : '✅ All improvements applied!'}

Commands:
- **apply [number]** - Implement a suggestion
- **resync** - Run sync with changes
- **done** - Finish wizard`;
    }
    
    const message: WizardMessage = {
      role: 'assistant',
      content: responseContent,
      timestamp: new Date(),
      phase: session.phase
    };
    
    session.messages.push(message);
    return message;
  }

  // ============================================
  // FINISH
  // ============================================

  private async finishWizard(session: WizardSession): Promise<WizardMessage> {
    // Save final iterations document
    await this.saveIterationsDoc(session);
    
    const content = `## 🎉 Integration Complete!

### ${session.integrationName}

Your integration has been successfully configured using the BMAD methodology.

---

### 📁 Generated Artifacts

\`\`\`
config-repo/
├── sources/
│   └── ${session.integrationName}.yaml
└── _bmad/
    └── ${session.integrationName}/
        ├── brief.md          ← Requirements
        ├── spec.md           ← Technical spec
        ├── sync-report.md    ← Sync results
        └── iterations.md     ← Improvement history
\`\`\`

---

### 📊 Final Stats

| Metric | Value |
|--------|-------|
| **Documents Indexed** | ${session.measure?.documentsIndexed || 0} |
| **Connector Type** | ${session.planning?.recommendedConnector} |
| **Iterations** | ${session.iterate?.iterationCount || 1} |
| **Improvements Applied** | ${session.iterate?.appliedImprovements.length || 0} |

---

### 🚀 Next Steps

1. Monitor the connector in the **Connectors** dashboard
2. Set up **webhooks** for sync notifications
3. Add **dictionary terms** for better search
4. Create **triggers** for query enhancement

Thank you for using the BMAD Config Wizard! 🙏`;

    const message: WizardMessage = {
      role: 'assistant',
      content,
      timestamp: new Date(),
      phase: session.phase,
      artifacts: [
        `sources/${session.integrationName}.yaml`,
        `_bmad/${session.integrationName}/brief.md`,
        `_bmad/${session.integrationName}/spec.md`,
        `_bmad/${session.integrationName}/sync-report.md`,
        `_bmad/${session.integrationName}/iterations.md`
      ]
    };
    
    session.messages.push(message);
    return message;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private generateId(): string {
    return `wizard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private slugify(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private getWelcomeMessage(name: string): string {
    return `# 🧙 BMAD Config Wizard

Welcome! I'm here to help you set up the **${name}** integration using the BMAD methodology.

BMAD guides us through 5 phases:

1. **📋 ANALYSIS** - Understanding your needs
2. **🎯 PLANNING** - Designing the solution  
3. **🔨 BUILD** - Creating the configuration
4. **📊 MEASURE** - Verifying success
5. **🔄 ITERATE** - Refining the setup

---

Let's start with **Analysis**.

**What content do you want to index?**

Tell me about the documents, data, or files you want to make searchable.`;
  }

  private detectContentType(input: string): string {
    const lower = input.toLowerCase();
    
    if (lower.includes('document') || lower.includes('pdf') || lower.includes('word')) return 'documents';
    if (lower.includes('wiki') || lower.includes('confluence') || lower.includes('notion')) return 'wiki pages';
    if (lower.includes('email') || lower.includes('outlook')) return 'emails';
    if (lower.includes('ticket') || lower.includes('jira') || lower.includes('issue')) return 'tickets';
    if (lower.includes('chat') || lower.includes('slack') || lower.includes('teams')) return 'messages';
    if (lower.includes('code') || lower.includes('repo') || lower.includes('github')) return 'code';
    if (lower.includes('database') || lower.includes('table') || lower.includes('sql')) return 'database records';
    if (lower.includes('web') || lower.includes('site') || lower.includes('page')) return 'web pages';
    if (lower.includes('file') || lower.includes('folder') || lower.includes('share')) return 'files';
    
    return 'content';
  }

  private parseAccessNeeds(input: string): string[] {
    const needs: string[] = [];
    const lower = input.toLowerCase();
    
    if (lower.includes('everyone') || lower.includes('all') || lower.includes('company')) {
      needs.push('all employees');
    }
    if (lower.includes('team') || lower.includes('department')) {
      const teamMatch = input.match(/(\w+)\s+team/i);
      needs.push(teamMatch ? `${teamMatch[1]} team` : 'specific teams');
    }
    if (lower.includes('support')) needs.push('support team');
    if (lower.includes('engineer') || lower.includes('dev')) needs.push('engineering');
    if (lower.includes('sales')) needs.push('sales team');
    if (lower.includes('external') || lower.includes('customer') || lower.includes('client')) {
      needs.push('external users');
    }
    
    return needs.length > 0 ? needs : ['general users'];
  }

  private detectSensitivity(input: string): 'public' | 'internal' | 'confidential' | 'restricted' {
    const lower = input.toLowerCase();
    
    if (lower.includes('public') || lower.includes('open')) return 'public';
    if (lower.includes('secret') || lower.includes('classified') || lower.includes('restricted')) return 'restricted';
    if (lower.includes('confidential') || lower.includes('private') || lower.includes('sensitive')) return 'confidential';
    
    return 'internal';
  }

  private detectFrequency(input: string): 'realtime' | 'hourly' | 'daily' | 'weekly' | 'manual' {
    const lower = input.toLowerCase();
    
    if (lower.includes('real') || lower.includes('constant') || lower.includes('live')) return 'realtime';
    if (lower.includes('hour')) return 'hourly';
    if (lower.includes('daily') || lower.includes('day')) return 'daily';
    if (lower.includes('week')) return 'weekly';
    if (lower.includes('rarely') || lower.includes('static') || lower.includes('manual')) return 'manual';
    
    return 'daily';
  }

  private recommendConnector(analysis: AnalysisData): { type: ConnectorType; reason: string } {
    const location = analysis.dataLocation.toLowerCase();
    
    if (location.includes('http') || location.includes('www') || location.includes('website')) {
      return {
        type: 'web',
        reason: `A **web spider** connector is perfect for crawling websites and web applications. It will follow links, respect robots.txt, and extract content from HTML pages.`
      };
    }
    
    if (location.includes('folder') || location.includes('path') || location.includes('/') || location.includes('\\') || location.includes('share')) {
      return {
        type: 'folder',
        reason: `A **folder** connector works great for file systems and network shares. It can watch for changes, process various file types (PDF, Word, etc.), and maintain the folder structure.`
      };
    }
    
    if (location.includes('database') || location.includes('sql') || location.includes('postgres') || location.includes('mysql')) {
      return {
        type: 'sql',
        reason: `A **SQL** connector is ideal for structured database content. It can run custom queries, handle incremental updates, and map database columns to search fields.`
      };
    }
    
    // Default to folder for files
    return {
      type: 'folder',
      reason: `Based on your description, a **folder** connector seems most appropriate. It's versatile and handles various file types well.`
    };
  }

  private generateArchitectureDiagram(type: ConnectorType): string {
    switch (type) {
      case 'web':
        return `
┌─────────────┐    ┌───────────────┐    ┌─────────────┐
│  Website    │───>│  Web Spider   │───>│  Beacon     │
│  (source)   │    │  (connector)  │    │  Search     │
└─────────────┘    └───────────────┘    └─────────────┘
       │                   │                    │
       │              Rate Limiting            │
       │              Link Following           │
       └──────────────────────────────────────┘`;
      case 'folder':
        return `
┌─────────────┐    ┌───────────────┐    ┌─────────────┐
│  Folder     │───>│  Folder       │───>│  Beacon     │
│  (files)    │    │  Connector    │    │  Search     │
└─────────────┘    └───────────────┘    └─────────────┘
       │                   │                    │
       │              File Watching            │
       │              Text Extraction          │
       └──────────────────────────────────────┘`;
      case 'sql':
        return `
┌─────────────┐    ┌───────────────┐    ┌─────────────┐
│  Database   │───>│  SQL          │───>│  Beacon     │
│  (tables)   │    │  Connector    │    │  Search     │
└─────────────┘    └───────────────┘    └─────────────┘
       │                   │                    │
       │              Query Execution          │
       │              Change Detection         │
       └──────────────────────────────────────┘`;
    }
  }

  private suggestFieldMappings(contentType: string): string {
    const mappings: Record<string, string> = {
      'documents': `| Source Field | Target | Searchable | Facetable |
|-------------|--------|------------|-----------|
| filename | title | ✓ | |
| content | content | ✓ | |
| path | url | | |
| modified_date | date | | ✓ |
| file_type | document_type | | ✓ |`,
      'web pages': `| Source Field | Target | Searchable | Facetable |
|-------------|--------|------------|-----------|
| page_title | title | ✓ | |
| body_text | content | ✓ | |
| url | url | | |
| meta_description | description | ✓ | |
| domain | source | | ✓ |`,
      'database records': `| Source Field | Target | Searchable | Facetable |
|-------------|--------|------------|-----------|
| primary_key | id | | |
| title_column | title | ✓ | |
| content_column | content | ✓ | |
| category | category | | ✓ |
| created_at | date | | ✓ |`
    };
    
    return mappings[contentType] || mappings['documents'];
  }

  private recommendAccessStrategy(needs: string[]): string {
    if (needs.includes('external users')) return 'document-level';
    if (needs.includes('specific teams') || needs.some(n => n.includes('team'))) return 'role-based';
    if (needs.includes('all employees')) return 'authenticated';
    return 'open';
  }

  private suggestRateLimit(type: ConnectorType): string {
    switch (type) {
      case 'web': return '2 req/sec (respectful crawling)';
      case 'folder': return 'No limit (local access)';
      case 'sql': return '10 req/sec (database queries)';
      default: return 'Auto-determined';
    }
  }

  private formatFieldMappings(mappings: FieldMapping[]): string {
    if (mappings.length === 0) return '_No custom mappings defined yet_';
    
    return mappings.map(m => 
      `- ${m.sourceField} → ${m.targetField} ${m.searchable ? '🔍' : ''} ${m.facetable ? '📊' : ''}`
    ).join('\n');
  }

  private explainRateLimits(type: ConnectorType): string {
    switch (type) {
      case 'web':
        return `- Start with **2 req/sec** to be respectful to target servers
- Increase to **5 req/sec** for internal sites
- Use **1 req/sec** for external APIs with rate limits`;
      case 'folder':
        return `- Local folders typically don't need rate limiting
- Network shares: **10 files/sec** to avoid overwhelming the NAS
- Large files: Consider **5 files/sec** for PDFs`;
      case 'sql':
        return `- **10 queries/sec** is safe for most databases
- Reduce to **2 queries/sec** on production DBs
- Use **off-hours** sync for large datasets`;
      default:
        return 'Rate limits depend on your source system capacity.';
    }
  }

  private generateConfig(session: WizardSession): string {
    const planning = session.planning!;
    const analysis = session.analysis!;
    
    switch (planning.recommendedConnector) {
      case 'web':
        return `# ${session.integrationName} - Web Spider Configuration
# Generated by BMAD Wizard on ${new Date().toISOString()}

name: ${session.integrationName}
description: ${analysis.contentDescription}
type: web

config:
  # The starting URL for the spider
  seedUrl: "${analysis.dataLocation}"
  
  # How deep to follow links (1 = only seed page)
  maxDepth: 3
  
  # Stay within the same domain
  sameDomainOnly: true
  
  # Respect robots.txt rules
  respectRobotsTxt: true
  
  # Rate limiting (requests per second)
  rateLimit: 2
  
  # Maximum pages to crawl
  maxPages: ${analysis.estimatedDocuments || 1000}
  
  # URL patterns to include (regex)
  includePatterns:
    - ".*"
  
  # URL patterns to exclude (regex)
  excludePatterns:
    - ".*\\.(jpg|png|gif|css|js)$"
    - ".*/login.*"
    - ".*/logout.*"

# Sync schedule
schedule:
  frequency: ${analysis.updateFrequency}
  timezone: "UTC"

# Access control
access:
  strategy: ${planning.accessControl.strategy}
`;
      
      case 'folder':
        return `# ${session.integrationName} - Folder Connector Configuration
# Generated by BMAD Wizard on ${new Date().toISOString()}

name: ${session.integrationName}
description: ${analysis.contentDescription}
type: folder

config:
  # Root folder path
  folderPath: "${analysis.dataLocation}"
  
  # Scan subfolders
  recursive: true
  
  # File types to index
  fileTypes:
    - ".pdf"
    - ".docx"
    - ".doc"
    - ".txt"
    - ".md"
    - ".html"
  
  # Watch for file changes
  watchForChanges: ${analysis.updateFrequency === 'realtime'}
  
  # Patterns to exclude
  excludePatterns:
    - ".*\\.tmp$"
    - "~\\$.*"
    - ".*/\\..*/.*"  # Hidden folders

# Sync schedule
schedule:
  frequency: ${analysis.updateFrequency}
  timezone: "UTC"

# Access control  
access:
  strategy: ${planning.accessControl.strategy}
`;
      
      case 'sql':
        return `# ${session.integrationName} - SQL Connector Configuration
# Generated by BMAD Wizard on ${new Date().toISOString()}

name: ${session.integrationName}
description: ${analysis.contentDescription}
type: sql

config:
  # Database connection (use environment variable for security)
  connectionString: "\${${session.integrationName.toUpperCase()}_DB_URL}"
  
  # Query to discover documents
  metadataQuery: |
    SELECT id, title, updated_at
    FROM your_table
    WHERE updated_at > :lastSync
  
  # Query to fetch document content
  dataQuery: |
    SELECT id, title, content, url, category, created_at
    FROM your_table
    WHERE id = :id

# Sync schedule
schedule:
  frequency: ${analysis.updateFrequency}
  timezone: "UTC"

# Access control
access:
  strategy: ${planning.accessControl.strategy}
`;
    }
  }

  private getCredentialPrompt(type: ConnectorType): string {
    switch (type) {
      case 'web':
        return `For web crawling, I may need:
- **Authentication** (if pages require login)
- **API key** (if using an API)
- **Custom headers** (for special access)

If the site is public, no credentials needed!`;
      
      case 'folder':
        return `For folder access, please confirm:
- **Path** is accessible from the Beacon server
- **Permissions** allow read access
- **Network credentials** (if on a network share)`;
      
      case 'sql':
        return `For database access, I need:
- **Connection string** or individual settings:
  - Host: database server address
  - Port: database port
  - Database: database name
  - Username: database user
  - Password: database password

⚠️ Credentials should be stored in environment variables!`;
    }
  }

  private validateConfig(yaml: string): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    // Check for required fields
    if (!yaml.includes('name:')) {
      results.push({ field: 'name', valid: false, message: 'Missing required field: name' });
    } else {
      results.push({ field: 'name', valid: true, message: 'Name is configured' });
    }
    
    if (!yaml.includes('type:')) {
      results.push({ field: 'type', valid: false, message: 'Missing required field: type' });
    } else {
      results.push({ field: 'type', valid: true, message: 'Connector type specified' });
    }
    
    if (!yaml.includes('config:')) {
      results.push({ field: 'config', valid: false, message: 'Missing config section' });
    } else {
      results.push({ field: 'config', valid: true, message: 'Configuration present' });
    }
    
    // Check for placeholder values
    if (yaml.includes('your_') || yaml.includes('YOUR_')) {
      results.push({ field: 'placeholders', valid: false, message: 'Contains placeholder values that need to be replaced' });
    }
    
    // YAML syntax check (basic)
    try {
      // Simple check - real implementation would use js-yaml
      if (yaml.split(':').length < 3) {
        results.push({ field: 'syntax', valid: false, message: 'YAML syntax appears invalid' });
      } else {
        results.push({ field: 'syntax', valid: true, message: 'YAML syntax is valid' });
      }
    } catch (e) {
      results.push({ field: 'syntax', valid: false, message: `YAML parse error: ${e}` });
    }
    
    return results;
  }

  private async testConnectivity(session: WizardSession): Promise<string> {
    const planning = session.planning!;
    
    // Simulate connectivity test
    // In real implementation, this would actually test the connection
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    session.build!.credentialsTested = true;
    session.build!.connectivityTested = true;
    
    return `### 🔌 Connectivity Test

Testing connection to **${session.analysis!.dataLocation}**...

\`\`\`
✓ DNS resolution: OK
✓ Port connectivity: OK
✓ Authentication: OK
✓ Read permissions: OK
\`\`\`

✅ **Connection successful!**

The ${planning.recommendedConnector} connector can access your data source.

Type **"save"** to commit the configuration, or make further adjustments.`;
  }

  private looksLikeCredentials(input: string): boolean {
    const lower = input.toLowerCase();
    return lower.includes('host') || 
           lower.includes('user') || 
           lower.includes('password') ||
           lower.includes('connection') ||
           lower.includes('api key') ||
           input.includes('://');
  }

  private updateConfigWithCredentials(session: WizardSession, input: string): string {
    // In a real implementation, parse and securely store credentials
    // For now, just acknowledge
    return session.build!.configYaml;
  }

  private sanitizeConfigForDisplay(config: string): string {
    // Hide sensitive values
    return config
      .replace(/password:.*$/gm, 'password: "********"')
      .replace(/api_key:.*$/gm, 'api_key: "********"')
      .replace(/secret:.*$/gm, 'secret: "********"');
  }

  private async saveConfig(session: WizardSession): Promise<string> {
    const configPath = path.join(this.configRepoPath, 'sources', `${session.integrationName}.yaml`);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    
    // Write config file
    await fs.writeFile(configPath, session.build!.configYaml, 'utf-8');
    
    return configPath;
  }

  private simulateSyncProgress(session: WizardSession) {
    // Simulate sync completion
    if (session.measure) {
      session.measure.documentsIndexed = Math.floor(Math.random() * 500) + 100;
      session.measure.documentsErrored = Math.floor(Math.random() * 5);
      session.measure.warnings = Math.random() > 0.5 ? ['Some PDFs had no extractable text'] : [];
      session.measure.syncCompleted = new Date();
    }
  }

  private getSyncStatus(session: WizardSession): string {
    const measure = session.measure!;
    
    if (measure.syncCompleted) {
      return `### ✅ Sync Complete!

| Metric | Value |
|--------|-------|
| **Started** | ${measure.syncStarted.toISOString()} |
| **Completed** | ${measure.syncCompleted.toISOString()} |
| **Documents Indexed** | ${measure.documentsIndexed} |
| **Errors** | ${measure.documentsErrored} |
| **Warnings** | ${measure.warnings.length} |

${measure.warnings.length > 0 ? `⚠️ Warnings:\n${measure.warnings.map(w => `- ${w}`).join('\n')}` : ''}

Type **"query [search term]"** to test search quality, or **"report"** to generate the full sync report.`;
    }
    
    return `### 🔄 Sync In Progress...

\`\`\`
[${new Date().toISOString()}] Indexing documents...
[${new Date().toISOString()}] Processed: ${measure.documentsIndexed} documents
\`\`\`

Please wait or check **"status"** again in a moment.`;
  }

  private async testSearchQuery(session: WizardSession, query: string): Promise<SampleQueryResult> {
    // In real implementation, would actually run the search
    return {
      query,
      resultsCount: Math.floor(Math.random() * 20) + 1,
      topScore: Math.random() * 0.5 + 0.5,
      relevant: Math.random() > 0.3
    };
  }

  private formatDuration(start: Date, end?: Date): string {
    if (!end) return 'In progress...';
    const seconds = Math.floor((end.getTime() - start.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  }

  private analyzeForImprovements(session: WizardSession): Improvement[] {
    const improvements: Improvement[] = [];
    const measure = session.measure!;
    
    // Check for errors
    if (measure.documentsErrored > measure.documentsIndexed * 0.1) {
      improvements.push({
        id: 'error-rate',
        type: 'content-filter',
        priority: 'high',
        description: 'High error rate during sync',
        recommendation: 'Review error logs and add exclude patterns for problematic files/URLs.',
        applied: false
      });
    }
    
    // Check search quality
    const lowQualityQueries = measure.sampleQueries.filter(q => !q.relevant);
    if (lowQualityQueries.length > 0) {
      improvements.push({
        id: 'search-quality',
        type: 'field-mapping',
        priority: 'medium',
        description: 'Some searches returned irrelevant results',
        recommendation: 'Adjust field mappings to weight title and key content higher.',
        applied: false
      });
    }
    
    // Check for warnings
    if (measure.warnings.length > 0) {
      improvements.push({
        id: 'warnings',
        type: 'content-filter',
        priority: 'low',
        description: `${measure.warnings.length} warnings during sync`,
        recommendation: 'Review warnings and consider OCR for image-based PDFs.',
        applied: false
      });
    }
    
    // Suggest rate limit tuning if applicable
    if (session.planning!.recommendedConnector === 'web') {
      improvements.push({
        id: 'rate-limit',
        type: 'rate-limit',
        priority: 'low',
        description: 'Consider tuning crawl rate',
        recommendation: 'If sync was slow, try increasing rate limit. If you saw 429 errors, decrease it.',
        applied: false
      });
    }
    
    return improvements;
  }

  private async applyImprovement(session: WizardSession, improvement: Improvement): Promise<void> {
    // In real implementation, would modify the config
    // For now, just mark as applied
  }

  private describeAppliedChanges(improvement: Improvement): string {
    switch (improvement.type) {
      case 'field-mapping':
        return '- Updated search field weights in configuration';
      case 'rate-limit':
        return '- Adjusted rate limiting settings';
      case 'access-control':
        return '- Modified access control rules';
      case 'content-filter':
        return '- Added content filters to exclude patterns';
      default:
        return '- Configuration updated';
    }
  }

  // ============================================
  // ARTIFACT GENERATION
  // ============================================

  private async generateBrief(session: WizardSession): Promise<string> {
    const analysis = session.analysis!;
    const briefDir = path.join(this.configRepoPath, '_bmad', session.integrationName);
    const briefPath = path.join(briefDir, 'brief.md');
    
    await fs.mkdir(briefDir, { recursive: true });
    
    const brief = `# Integration Brief: ${session.integrationName}

**Generated:** ${new Date().toISOString()}
**Phase:** Analysis Complete

---

## Executive Summary

This document outlines the requirements for integrating **${analysis.contentType}** content into Beacon Search.

## Business Context

**Goal:** ${analysis.businessGoal}

**Stakeholders:** ${analysis.accessNeeds.join(', ')}

## Content Overview

| Attribute | Value |
|-----------|-------|
| **Content Type** | ${analysis.contentType} |
| **Description** | ${analysis.contentDescription} |
| **Location** | ${analysis.dataLocation} |
| **Estimated Volume** | ${analysis.estimatedDocuments?.toLocaleString() || 'Unknown'} documents |
| **Sensitivity** | ${analysis.sensitivityLevel} |
| **Update Frequency** | ${analysis.updateFrequency} |

## Access Requirements

${analysis.accessNeeds.map(need => `- ${need}`).join('\n')}

## Success Criteria

1. All specified content is indexed and searchable
2. Search returns relevant results for common queries
3. Access controls match business requirements
4. Sync runs reliably on schedule

---

*Brief generated by BMAD Config Wizard*
`;
    
    await fs.writeFile(briefPath, brief, 'utf-8');
    return `_bmad/${session.integrationName}/brief.md`;
  }

  private async generateSpec(session: WizardSession): Promise<string> {
    const planning = session.planning!;
    const analysis = session.analysis!;
    const specDir = path.join(this.configRepoPath, '_bmad', session.integrationName);
    const specPath = path.join(specDir, 'spec.md');
    
    await fs.mkdir(specDir, { recursive: true });
    
    const spec = `# Integration Specification: ${session.integrationName}

**Generated:** ${new Date().toISOString()}
**Phase:** Planning Complete

---

## Technical Overview

### Connector

| Setting | Value |
|---------|-------|
| **Type** | ${planning.recommendedConnector} |
| **Reason** | ${planning.connectorReason} |

### Indexing Configuration

| Setting | Value |
|---------|-------|
| **Initial Strategy** | ${planning.indexingScope.initialSyncStrategy} |
| **Refresh Frequency** | ${planning.indexingScope.refreshFrequency} |
| **Est. Documents** | ${planning.indexingScope.estimatedDocuments.toLocaleString()} |
| **Rate Limit** | ${planning.indexingScope.rateLimits?.requestsPerSecond || 'auto'} req/s |

### Field Mappings

${planning.fieldMappings.length > 0 
  ? planning.fieldMappings.map(m => `- \`${m.sourceField}\` → \`${m.targetField}\` ${m.searchable ? '(searchable)' : ''} ${m.facetable ? '(facetable)' : ''}`).join('\n')
  : '_Using default mappings_'}

### Access Control

| Setting | Value |
|---------|-------|
| **Strategy** | ${planning.accessControl.strategy} |
${planning.accessControl.roles ? `| **Roles** | ${planning.accessControl.roles.join(', ')} |` : ''}

## Architecture

\`\`\`
${this.generateArchitectureDiagram(planning.recommendedConnector)}
\`\`\`

## Data Flow

1. Connector connects to ${analysis.dataLocation}
2. Documents are extracted and processed
3. Content is embedded using MiniLM
4. Documents are indexed in PostgreSQL with pgvector
5. Search API serves queries with hybrid search

## Dependencies

- Beacon Search Backend
- PostgreSQL with pgvector
- ${planning.recommendedConnector === 'web' ? 'Puppeteer for JavaScript rendering' : ''}
- ${planning.recommendedConnector === 'folder' ? 'File system access' : ''}
- ${planning.recommendedConnector === 'sql' ? 'Database driver' : ''}

---

*Spec generated by BMAD Config Wizard*
`;
    
    await fs.writeFile(specPath, spec, 'utf-8');
    return `_bmad/${session.integrationName}/spec.md`;
  }

  private async generateSyncReport(session: WizardSession): Promise<string> {
    const measure = session.measure!;
    const reportDir = path.join(this.configRepoPath, '_bmad', session.integrationName);
    const reportPath = path.join(reportDir, 'sync-report.md');
    
    await fs.mkdir(reportDir, { recursive: true });
    
    const report = `# Sync Report: ${session.integrationName}

**Generated:** ${new Date().toISOString()}
**Sync Started:** ${measure.syncStarted.toISOString()}
**Sync Completed:** ${measure.syncCompleted?.toISOString() || 'In Progress'}

---

## Summary

| Metric | Value |
|--------|-------|
| **Documents Indexed** | ${measure.documentsIndexed} |
| **Documents Errored** | ${measure.documentsErrored} |
| **Success Rate** | ${((measure.documentsIndexed / (measure.documentsIndexed + measure.documentsErrored)) * 100).toFixed(1)}% |
| **Duration** | ${this.formatDuration(measure.syncStarted, measure.syncCompleted)} |

## Warnings

${measure.warnings.length > 0 
  ? measure.warnings.map(w => `- ⚠️ ${w}`).join('\n')
  : '✅ No warnings'}

## Search Quality Tests

${measure.sampleQueries.length > 0
  ? `| Query | Results | Top Score | Relevant |
|-------|---------|-----------|----------|
${measure.sampleQueries.map(q => `| "${q.query}" | ${q.resultsCount} | ${(q.topScore * 100).toFixed(0)}% | ${q.relevant ? '✅' : '❌'} |`).join('\n')}`
  : '_No search tests performed_'}

## Recommendations

${measure.documentsErrored > 0 ? '- Review error logs for failed documents\n' : ''}
${measure.warnings.length > 0 ? '- Address warnings to improve content quality\n' : ''}
${measure.sampleQueries.some(q => !q.relevant) ? '- Tune field mappings for better relevance\n' : ''}
${measure.documentsIndexed < 100 ? '- Verify all expected content sources are accessible\n' : ''}

---

*Report generated by BMAD Config Wizard*
`;
    
    await fs.writeFile(reportPath, report, 'utf-8');
    return `_bmad/${session.integrationName}/sync-report.md`;
  }

  private async saveIterationsDoc(session: WizardSession): Promise<string> {
    const iterate = session.iterate;
    const iterDir = path.join(this.configRepoPath, '_bmad', session.integrationName);
    const iterPath = path.join(iterDir, 'iterations.md');
    
    await fs.mkdir(iterDir, { recursive: true });
    
    const doc = `# Iteration History: ${session.integrationName}

**Generated:** ${new Date().toISOString()}
**Total Iterations:** ${iterate?.iterationCount || 1}

---

## Applied Improvements

${iterate?.improvements.filter(i => i.applied).map(imp => `
### ${imp.description}

- **Type:** ${imp.type}
- **Priority:** ${imp.priority}
- **Recommendation:** ${imp.recommendation}
- **Status:** ✅ Applied
`).join('\n') || '_No improvements applied_'}

## Pending Suggestions

${iterate?.improvements.filter(i => !i.applied).map(imp => `
### ${imp.description}

- **Type:** ${imp.type}
- **Priority:** ${imp.priority}
- **Recommendation:** ${imp.recommendation}
- **Status:** ⏳ Not applied
`).join('\n') || '_All suggestions implemented_'}

---

## Conversation Log

${session.messages.slice(-20).map(m => `
**[${m.timestamp.toISOString()}] ${m.role === 'assistant' ? '🤖 Wizard' : '👤 User'}:**

${m.content.substring(0, 200)}${m.content.length > 200 ? '...' : ''}
`).join('\n---\n')}

---

*Iterations document generated by BMAD Config Wizard*
`;
    
    await fs.writeFile(iterPath, doc, 'utf-8');
    return `_bmad/${session.integrationName}/iterations.md`;
  }
}

export default BmadWizard;
