/**
 * BMAD Wizard API Routes
 * 
 * Endpoints for the BMAD-powered configuration wizard
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { BmadWizard, WizardSession, BmadPhase } from './bmad-wizard';

export function createWizardRoutes(pool: Pool, configRepoPath: string = '/app/config-repo'): Router {
  const router = Router();
  const wizard = new BmadWizard(pool, configRepoPath);

  // ============================================
  // SESSION MANAGEMENT
  // ============================================

  /**
   * POST /api/wizard/sessions
   * Create a new wizard session
   */
  router.post('/sessions', (req: Request, res: Response) => {
    try {
      const { integrationName } = req.body;
      
      if (!integrationName) {
        return res.status(400).json({ 
          error: 'Integration name is required',
          hint: 'Provide a name for this integration, e.g., "company-sharepoint" or "support-docs"'
        });
      }
      
      const session = wizard.createSession(integrationName);
      
      res.status(201).json({
        sessionId: session.id,
        phase: session.phase,
        integrationName: session.integrationName,
        messages: session.messages,
        hint: 'Use POST /api/wizard/chat to continue the conversation'
      });
    } catch (error) {
      console.error('Wizard session creation error:', error);
      res.status(500).json({ error: 'Failed to create wizard session' });
    }
  });

  /**
   * GET /api/wizard/sessions/:sessionId
   * Get session state
   */
  router.get('/sessions/:sessionId', (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const session = wizard.getSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      res.json({
        sessionId: session.id,
        phase: session.phase,
        integrationName: session.integrationName,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        analysis: session.analysis,
        planning: session.planning,
        build: session.build,
        measure: session.measure,
        iterate: session.iterate,
        messageCount: session.messages.length
      });
    } catch (error) {
      console.error('Wizard session fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch session' });
    }
  });

  /**
   * GET /api/wizard/sessions/:sessionId/messages
   * Get conversation history
   */
  router.get('/sessions/:sessionId/messages', (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { limit = 50, offset = 0 } = req.query;
      
      const session = wizard.getSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      const messages = session.messages.slice(
        Number(offset),
        Number(offset) + Number(limit)
      );
      
      res.json({
        sessionId: session.id,
        phase: session.phase,
        total: session.messages.length,
        offset: Number(offset),
        limit: Number(limit),
        messages
      });
    } catch (error) {
      console.error('Wizard messages fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  // ============================================
  // CHAT INTERFACE
  // ============================================

  /**
   * POST /api/wizard/chat
   * Main chat endpoint - processes user input and returns wizard response
   */
  router.post('/chat', async (req: Request, res: Response) => {
    try {
      const { sessionId, message } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ 
          error: 'Session ID is required',
          hint: 'Create a session first with POST /api/wizard/sessions'
        });
      }
      
      if (!message) {
        return res.status(400).json({ 
          error: 'Message is required',
          hint: 'Provide your response to the wizard\'s question'
        });
      }
      
      const session = wizard.getSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      // Process based on current phase
      let response;
      switch (session.phase) {
        case 'analysis':
          response = await wizard.processAnalysis(sessionId, message);
          break;
        case 'planning':
          response = await wizard.processPlanning(sessionId, message);
          break;
        case 'build':
          response = await wizard.processBuild(sessionId, message);
          break;
        case 'measure':
          response = await wizard.processMeasure(sessionId, message);
          break;
        case 'iterate':
          response = await wizard.processIterate(sessionId, message);
          break;
        default:
          return res.status(400).json({ error: `Unknown phase: ${session.phase}` });
      }
      
      // Get updated session state
      const updatedSession = wizard.getSession(sessionId)!;
      
      res.json({
        sessionId: updatedSession.id,
        phase: updatedSession.phase,
        response: response,
        phaseData: getPhaseData(updatedSession),
        progress: calculateProgress(updatedSession)
      });
    } catch (error) {
      console.error('Wizard chat error:', error);
      res.status(500).json({ error: 'Failed to process message', details: (error as Error).message });
    }
  });

  // ============================================
  // PHASE-SPECIFIC ENDPOINTS
  // ============================================

  /**
   * POST /api/wizard/analyze
   * Run analysis phase and return brief
   */
  router.post('/analyze', async (req: Request, res: Response) => {
    try {
      const { sessionId, answers } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }
      
      const session = wizard.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      if (session.phase !== 'analysis') {
        return res.status(400).json({ 
          error: `Cannot run analysis in ${session.phase} phase`,
          currentPhase: session.phase
        });
      }
      
      // Process all answers
      let lastResponse;
      if (answers) {
        if (answers.contentType) {
          lastResponse = await wizard.processAnalysis(sessionId, answers.contentType);
        }
        if (answers.accessNeeds) {
          lastResponse = await wizard.processAnalysis(sessionId, answers.accessNeeds);
        }
        if (answers.businessGoal) {
          lastResponse = await wizard.processAnalysis(sessionId, answers.businessGoal);
        }
        if (answers.dataLocation) {
          lastResponse = await wizard.processAnalysis(sessionId, answers.dataLocation);
        }
        if (answers.volumeAndFrequency) {
          lastResponse = await wizard.processAnalysis(sessionId, answers.volumeAndFrequency);
        }
      }
      
      const updatedSession = wizard.getSession(sessionId)!;
      
      res.json({
        sessionId: updatedSession.id,
        phase: updatedSession.phase,
        analysis: updatedSession.analysis,
        briefGenerated: updatedSession.analysis?.briefGenerated || false,
        lastResponse
      });
    } catch (error) {
      console.error('Wizard analyze error:', error);
      res.status(500).json({ error: 'Analysis failed', details: (error as Error).message });
    }
  });

  /**
   * POST /api/wizard/plan
   * Generate integration spec
   */
  router.post('/plan', async (req: Request, res: Response) => {
    try {
      const { sessionId, adjustments } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }
      
      const session = wizard.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      // Move to planning if still in analysis
      if (session.phase === 'analysis' && session.analysis?.briefGenerated) {
        await wizard.processAnalysis(sessionId, 'plan');
      }
      
      if (session.phase !== 'planning') {
        return res.status(400).json({ 
          error: `Cannot run planning in ${session.phase} phase`,
          hint: session.phase === 'analysis' ? 'Complete analysis first' : 'Already past planning phase'
        });
      }
      
      // Apply any adjustments
      let lastResponse;
      if (adjustments) {
        for (const adjustment of adjustments) {
          lastResponse = await wizard.processPlanning(sessionId, adjustment);
        }
      }
      
      const updatedSession = wizard.getSession(sessionId)!;
      
      res.json({
        sessionId: updatedSession.id,
        phase: updatedSession.phase,
        planning: updatedSession.planning,
        specGenerated: updatedSession.planning?.specGenerated || false,
        lastResponse
      });
    } catch (error) {
      console.error('Wizard plan error:', error);
      res.status(500).json({ error: 'Planning failed', details: (error as Error).message });
    }
  });

  /**
   * POST /api/wizard/build
   * Create config step by step
   */
  router.post('/build', async (req: Request, res: Response) => {
    try {
      const { sessionId, action, credentials } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }
      
      const session = wizard.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      // Move to build if in planning
      if (session.phase === 'planning' && session.planning?.specGenerated) {
        await wizard.processPlanning(sessionId, 'build');
      }
      
      if (session.phase !== 'build') {
        return res.status(400).json({ 
          error: `Cannot run build in ${session.phase} phase`,
          currentPhase: session.phase
        });
      }
      
      let lastResponse;
      
      // Process action
      if (action === 'validate') {
        lastResponse = await wizard.processBuild(sessionId, 'validate');
      } else if (action === 'test') {
        lastResponse = await wizard.processBuild(sessionId, 'test');
      } else if (action === 'save') {
        lastResponse = await wizard.processBuild(sessionId, 'save');
      } else if (credentials) {
        lastResponse = await wizard.processBuild(sessionId, credentials);
      }
      
      const updatedSession = wizard.getSession(sessionId)!;
      
      res.json({
        sessionId: updatedSession.id,
        phase: updatedSession.phase,
        build: {
          configPath: updatedSession.build?.configPath,
          validationResults: updatedSession.build?.validationResults,
          credentialsTested: updatedSession.build?.credentialsTested,
          connectivityTested: updatedSession.build?.connectivityTested,
          committed: updatedSession.build?.committed
        },
        lastResponse
      });
    } catch (error) {
      console.error('Wizard build error:', error);
      res.status(500).json({ error: 'Build failed', details: (error as Error).message });
    }
  });

  /**
   * POST /api/wizard/measure
   * Run sync and report results
   */
  router.post('/measure', async (req: Request, res: Response) => {
    try {
      const { sessionId, action, query } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }
      
      const session = wizard.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      // Move to measure if in build
      if (session.phase === 'build' && session.build?.committed) {
        await wizard.processBuild(sessionId, 'measure');
      }
      
      if (session.phase !== 'measure') {
        return res.status(400).json({ 
          error: `Cannot run measure in ${session.phase} phase`,
          currentPhase: session.phase
        });
      }
      
      let lastResponse;
      
      if (action === 'status') {
        lastResponse = await wizard.processMeasure(sessionId, 'status');
      } else if (action === 'query' && query) {
        lastResponse = await wizard.processMeasure(sessionId, `query ${query}`);
      } else if (action === 'report') {
        lastResponse = await wizard.processMeasure(sessionId, 'report');
      }
      
      const updatedSession = wizard.getSession(sessionId)!;
      
      res.json({
        sessionId: updatedSession.id,
        phase: updatedSession.phase,
        measure: {
          syncStarted: updatedSession.measure?.syncStarted,
          syncCompleted: updatedSession.measure?.syncCompleted,
          documentsIndexed: updatedSession.measure?.documentsIndexed,
          documentsErrored: updatedSession.measure?.documentsErrored,
          warnings: updatedSession.measure?.warnings,
          sampleQueries: updatedSession.measure?.sampleQueries,
          syncReportGenerated: updatedSession.measure?.syncReportGenerated
        },
        lastResponse
      });
    } catch (error) {
      console.error('Wizard measure error:', error);
      res.status(500).json({ error: 'Measure failed', details: (error as Error).message });
    }
  });

  /**
   * POST /api/wizard/iterate
   * Get improvement suggestions
   */
  router.post('/iterate', async (req: Request, res: Response) => {
    try {
      const { sessionId, action, improvementIndex } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }
      
      const session = wizard.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      // Move to iterate if in measure
      if (session.phase === 'measure' && session.measure?.syncReportGenerated) {
        await wizard.processMeasure(sessionId, 'iterate');
      }
      
      if (session.phase !== 'iterate') {
        return res.status(400).json({ 
          error: `Cannot run iterate in ${session.phase} phase`,
          currentPhase: session.phase
        });
      }
      
      let lastResponse;
      
      if (action === 'apply' && improvementIndex !== undefined) {
        lastResponse = await wizard.processIterate(sessionId, `apply ${improvementIndex}`);
      } else if (action === 'resync') {
        lastResponse = await wizard.processIterate(sessionId, 'resync');
      } else if (action === 'done' || action === 'finish') {
        lastResponse = await wizard.processIterate(sessionId, 'done');
      }
      
      const updatedSession = wizard.getSession(sessionId)!;
      
      res.json({
        sessionId: updatedSession.id,
        phase: updatedSession.phase,
        iterate: {
          improvements: updatedSession.iterate?.improvements,
          appliedImprovements: updatedSession.iterate?.appliedImprovements,
          iterationCount: updatedSession.iterate?.iterationCount
        },
        lastResponse
      });
    } catch (error) {
      console.error('Wizard iterate error:', error);
      res.status(500).json({ error: 'Iterate failed', details: (error as Error).message });
    }
  });

  // ============================================
  // UTILITY ENDPOINTS
  // ============================================

  /**
   * GET /api/wizard/phases
   * Get information about BMAD phases
   */
  router.get('/phases', (_req: Request, res: Response) => {
    res.json({
      phases: [
        {
          id: 'analysis',
          name: 'Analysis',
          icon: '📋',
          description: 'Understanding your integration needs',
          questions: [
            'What content do you want to index?',
            'Who needs access to this content?',
            'What\'s the business goal?',
            'Where is the content located?',
            'How much content and how often does it change?'
          ],
          output: 'Integration Brief'
        },
        {
          id: 'planning',
          name: 'Planning',
          icon: '🎯',
          description: 'Designing the integration solution',
          decisions: [
            'Connector type recommendation',
            'Field mapping design',
            'Access control strategy',
            'Indexing scope and schedule'
          ],
          output: 'Integration Spec'
        },
        {
          id: 'build',
          name: 'Build',
          icon: '🔨',
          description: 'Creating and validating the configuration',
          steps: [
            'Generate YAML configuration',
            'Configure credentials',
            'Validate configuration',
            'Test connectivity',
            'Commit to config-repo'
          ],
          output: 'Configuration File'
        },
        {
          id: 'measure',
          name: 'Measure',
          icon: '📊',
          description: 'Verifying the integration works',
          activities: [
            'Run initial sync',
            'Monitor progress',
            'Test search quality',
            'Review errors and warnings'
          ],
          output: 'Sync Report'
        },
        {
          id: 'iterate',
          name: 'Iterate',
          icon: '🔄',
          description: 'Refining based on results',
          actions: [
            'Review improvement suggestions',
            'Apply recommended changes',
            'Re-run sync',
            'Verify improvements'
          ],
          output: 'Iterations History'
        }
      ]
    });
  });

  /**
   * GET /api/wizard/connectors
   * Get available connector types and their requirements
   */
  router.get('/connectors', (_req: Request, res: Response) => {
    res.json({
      connectors: [
        {
          type: 'web',
          name: 'Web Spider',
          description: 'Crawl websites and web applications',
          bestFor: ['Public websites', 'Documentation sites', 'Wikis', 'Internal web apps'],
          requirements: ['URL to crawl', 'Optional: authentication credentials'],
          configuration: {
            seedUrl: 'Starting URL',
            maxDepth: 'How deep to follow links',
            maxPages: 'Maximum pages to crawl',
            rateLimit: 'Requests per second'
          }
        },
        {
          type: 'folder',
          name: 'Folder',
          description: 'Index files from local or network folders',
          bestFor: ['File shares', 'Document repositories', 'Local archives'],
          requirements: ['Folder path accessible from server'],
          configuration: {
            folderPath: 'Root folder to index',
            recursive: 'Include subfolders',
            fileTypes: 'File extensions to include',
            watchForChanges: 'Auto-sync on file changes'
          }
        },
        {
          type: 'sql',
          name: 'SQL Database',
          description: 'Index content from SQL databases',
          bestFor: ['Knowledge bases', 'CRM data', 'Custom applications'],
          requirements: ['Database connection string', 'Read access'],
          configuration: {
            connectionString: 'Database connection',
            metadataQuery: 'Query to discover documents',
            dataQuery: 'Query to fetch content'
          }
        }
      ]
    });
  });

  return router;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getPhaseData(session: WizardSession): any {
  switch (session.phase) {
    case 'analysis':
      return session.analysis;
    case 'planning':
      return session.planning;
    case 'build':
      return session.build;
    case 'measure':
      return session.measure;
    case 'iterate':
      return session.iterate;
    default:
      return null;
  }
}

function calculateProgress(session: WizardSession): { phase: BmadPhase; percent: number; steps: { name: string; completed: boolean }[] } {
  const phases: BmadPhase[] = ['analysis', 'planning', 'build', 'measure', 'iterate'];
  const currentIndex = phases.indexOf(session.phase);
  
  // Calculate phase completion
  let phasePercent = 0;
  
  switch (session.phase) {
    case 'analysis':
      const analysisFields = ['contentType', 'accessNeeds', 'businessGoal', 'dataLocation', 'estimatedDocuments'];
      const completedAnalysis = analysisFields.filter(f => session.analysis?.[f as keyof typeof session.analysis]);
      phasePercent = (completedAnalysis.length / analysisFields.length) * 100;
      break;
    case 'planning':
      phasePercent = session.planning?.specGenerated ? 100 : 50;
      break;
    case 'build':
      const buildSteps = [
        session.build?.validationResults?.length ?? 0 > 0,
        session.build?.credentialsTested,
        session.build?.connectivityTested,
        session.build?.committed
      ];
      phasePercent = (buildSteps.filter(Boolean).length / buildSteps.length) * 100;
      break;
    case 'measure':
      phasePercent = session.measure?.syncReportGenerated ? 100 : (session.measure?.syncCompleted ? 75 : 25);
      break;
    case 'iterate':
      const total = session.iterate?.improvements.length ?? 0;
      const applied = session.iterate?.appliedImprovements.length ?? 0;
      phasePercent = total > 0 ? (applied / total) * 100 : 100;
      break;
  }
  
  const overallPercent = (currentIndex * 20) + (phasePercent * 0.2);
  
  return {
    phase: session.phase,
    percent: Math.round(overallPercent),
    steps: [
      { name: 'Analysis', completed: currentIndex > 0 || (session.analysis?.briefGenerated ?? false) },
      { name: 'Planning', completed: currentIndex > 1 || (session.planning?.specGenerated ?? false) },
      { name: 'Build', completed: currentIndex > 2 || (session.build?.committed ?? false) },
      { name: 'Measure', completed: currentIndex > 3 || (session.measure?.syncReportGenerated ?? false) },
      { name: 'Iterate', completed: session.iterate?.improvements?.every(i => i.applied) ?? false }
    ]
  };
}

export default createWizardRoutes;
