const ProductManagerAgent = require('../../ai-engine/agents/product-manager.agent');
const TaskAnalyzerAgent = require('../../ai-engine/agents/task-analyzer.agent');
const MeetingSummarizerAgent = require('../../ai-engine/agents/meeting-summarizer.agent');

const Project = require('../models/Project.model');
const Task = require('../models/Task.model');
const ChatMessage = require('../models/ChatMessage.model');

const { cache } = require('../config/redis');
const logger = require('../utils/logger');

class AIOrchestrator {
  constructor() {
    this.pmAgent = null;
    this.analyzerAgent = null;
    this.meetingAgent = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      logger.info('🤖 Initializing AI Orchestrator...');

      // Create all AI agents
      this.pmAgent = new ProductManagerAgent();
      this.analyzerAgent = new TaskAnalyzerAgent();
      this.meetingAgent = new MeetingSummarizerAgent();

      // Initialize agents in parallel
      await Promise.all([
        this.pmAgent.initialize(),
        this.analyzerAgent.initialize()
      ]);

      this.initialized = true;
      logger.info('✅ AI Orchestrator initialized successfully');
    } catch (error) {
      logger.error('❌ AI Orchestrator initialization failed:', error);
      throw error;
    }
  }

  async chat(userId, message, context = {}) {
    await this.ensureInitialized();

    try {
      let enhancedContext = { ...context };

      // Load project and task data if projectId provided
      if (context.projectId) {
        const project = await Project.findById(context.projectId);
        const tasks = await Task.find({ project: context.projectId });

        enhancedContext.project = project;
        enhancedContext.tasks = tasks;
      }

      // Classify user intent
      const intent = this.classifyIntent(message);
      logger.info(`Intent classified: ${intent}`);

      // Route to appropriate handler
      let response;
      switch (intent) {
        case 'create_task':
          response = await this.handleTaskCreation(message, enhancedContext);
          break;
        case 'analyze_project':
          response = await this.handleProjectAnalysis(enhancedContext);
          break;
        case 'general_query':
        default:
          response = await this.handleGeneralQuery(message, enhancedContext);
      }

      // Save chat history
      await ChatMessage.create([
        {
          user: userId,
          role: 'user',
          content: message,
          context: { projectId: context.projectId }
        },
        {
          user: userId,
          role: 'ai',
          content: response.message || response.response,
          context: { projectId: context.projectId }
        }
      ]);

      return response;
    } catch (error) {
      logger.error('AI chat error:', error);
      throw error;
    }
  }

  classifyIntent(message) {
    const lower = message.toLowerCase();

    // Check for task creation intent
    if ((lower.includes('create') || lower.includes('add')) && 
        (lower.includes('task') || lower.includes('todo'))) {
      return 'create_task';
    }

    // Check for analysis intent
    if (lower.includes('analyze') || lower.includes('summary') || 
        lower.includes('status') || lower.includes('health')) {
      return 'analyze_project';
    }

    return 'general_query';
  }

  async handleTaskCreation(description, context) {
    try {
      // Use PM Agent to structure the task
      const taskData = await this.pmAgent.createTaskFromDescription(
        description,
        context.projectId
      );

      // Analyze task complexity
      const analysis = await this.analyzerAgent.analyzeTask(taskData, context);

      // Enrich task with analysis data
      const enrichedTask = {
        ...taskData,
        estimatedTime: analysis.estimatedHours,
        complexity: analysis.complexityScore,
        project: context.projectId,
        createdBy: context.userId
      };

      // Save to database
      const task = await Task.create({
        title: enrichedTask.title,
        description: enrichedTask.description,
        project: context.projectId,
        priority: enrichedTask.priority,
        estimatedTime: enrichedTask.estimatedTime,
        tags: enrichedTask.tags,
        createdBy: context.userId
      });

      // Update project progress
      await this.updateProjectProgress(context.projectId);

      return {
        success: true,
        task,
        analysis,
        message: `✅ Task created successfully! Estimated effort: ${analysis.estimatedHours} hours. Complexity: ${analysis.complexityScore}/10.`
      };
    } catch (error) {
      logger.error('Task creation error:', error);
      throw error;
    }
  }

  async handleProjectAnalysis(context) {
    try {
      const project = await Project.findById(context.projectId);
      const tasks = await Task.find({ project: context.projectId });

      if (!project) {
        throw new Error('Project not found');
      }

      // Use PM Agent to analyze project health
      const health = await this.pmAgent.analyzeProjectHealth(project, tasks);

      return {
        success: true,
        health,
        message: `📊 Project Health: ${health.status.toUpperCase()}\nScore: ${health.healthScore}/100\n\nKey Insights:\n${health.insights.map(i => `• ${i}`).join('\n')}`
      };
    } catch (error) {
      logger.error('Project analysis error:', error);
      throw error;
    }
  }

  async handleGeneralQuery(message, context) {
    try {
      const systemPrompt = this.buildSystemPrompt(context);
      const response = await this.pmAgent.model.call([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]);

      return {
        success: true,
        response: response.content,
        message: response.content
      };
    } catch (error) {
      logger.error('General query error:', error);
      throw error;
    }
  }

  buildSystemPrompt(context) {
    let prompt = `You are ZenAI, an intelligent AI Product Manager assistant.`;

    if (context.project && context.tasks) {
      const completedTasks = context.tasks.filter(t => t.status === 'done').length;
      const totalTasks = context.tasks.length;
      
      prompt += `\n\nCurrent Project Context:
- Project: ${context.project.name}
- Status: ${context.project.status}
- Total Tasks: ${totalTasks}
- Completed: ${completedTasks}
- Progress: ${totalTasks > 0 ? Math.round((completedTasks/totalTasks)*100) : 0}%`;
    }

    return prompt;
  }

  async transcribeMeeting(audioFilePath, context) {
    await this.ensureInitialized();

    try {
      // Transcribe and summarize meeting
      const result = await this.meetingAgent.transcribeAndSummarize(
        audioFilePath,
        context
      );

      // Create tasks from action items
      const createdTasks = [];
      for (const item of result.actionItems) {
        if (item.action) {
          try {
            const task = await this.handleTaskCreation(item.action, {
              ...context,
              assignee: item.owner,
              dueDate: item.dueDate
            });
            createdTasks.push(task.task);
          } catch (error) {
            logger.warn(`Failed to create task from action item: ${error.message}`);
          }
        }
      }

      return {
        success: true,
        transcription: result.transcription,
        summary: result.summary,
        actionItems: result.actionItems,
        createdTasks,
        message: `Meeting processed successfully! ${result.actionItems.length} action items identified, ${createdTasks.length} tasks created.`
      };
    } catch (error) {
      logger.error('Meeting transcription error:', error);
      throw error;
    }
  }

  async generateTaskSuggestions(projectId) {
    await this.ensureInitialized();

    try {
      const project = await Project.findById(projectId);
      const tasks = await Task.find({ project: projectId });

      if (!project) {
        throw new Error('Project not found');
      }

      // Use PM Agent to suggest tasks
      const suggestions = await this.pmAgent.suggestTaskBreakdown({
        title: project.name,
        description: project.description,
        existingTasks: tasks.map(t => t.title)
      });

      return {
        success: true,
        suggestions,
        message: `Generated ${suggestions.length} task suggestions`
      };
    } catch (error) {
      logger.error('Task suggestions error:', error);
      throw error;
    }
  }

  async updateProjectProgress(projectId) {
    try {
      const tasks = await Task.find({ project: projectId });
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'done').length;
      const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
      
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      await Project.findByIdAndUpdate(projectId, {
        progress,
        'metadata.totalTasks': totalTasks,
        'metadata.completedTasks': completedTasks,
        'metadata.inProgressTasks': inProgressTasks
      });

      await cache.clearPattern(`projects:*`);
    } catch (error) {
      logger.error('Project progress update error:', error);
    }
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

// Export singleton instance
const orchestrator = new AIOrchestrator();

module.exports = orchestrator;