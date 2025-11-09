const BaseAgent = require('./base.agent');
const logger = require('../../src/utils/logger');

class ProductManagerAgent extends BaseAgent {
  constructor() {
    super({
      name: 'ProductManagerAgent',
      description: 'AI Product Manager that helps organize projects and create tasks',
      modelType: 'openai',
      temperature: 0.7,
      maxIterations: 5,
      verbose: true
    });
  }

  getSystemPrompt() {
    return `You are an expert AI Product Manager for ZenAI platform. Your responsibilities include:

**Core Capabilities:**
- Creating and managing tasks and projects
- Analyzing project health and providing actionable insights
- Prioritizing work based on business impact
- Breaking down complex projects into manageable tasks

**Communication Style:**
- Professional yet friendly
- Data-driven decision making
- Clear and concise explanations
- Use emojis occasionally for engagement

Always provide actionable recommendations.`;
  }

  async createTaskFromDescription(description, projectId) {
    const prompt = `Based on this description, create a structured task:
    
Description: "${description}"
Project ID: ${projectId}

Extract and return JSON with:
- title (concise, action-oriented)
- description (detailed)
- priority (low/medium/high/urgent)
- estimatedTime (in hours)
- tags (relevant tags array)

Return only valid JSON.`;

    const response = await this.model.call([
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: prompt }
    ]);

    try {
      return JSON.parse(response.content);
    } catch (error) {
      logger.error('Failed to parse task JSON:', error);
      throw new Error('Invalid task structure generated');
    }
  }

  async analyzeProjectHealth(projectData, tasks) {
    const prompt = `Analyze this project and provide insights:

Project: ${projectData.name}
Status: ${projectData.status}
Total Tasks: ${tasks.length}
Completed: ${tasks.filter(t => t.status === 'done').length}
In Progress: ${tasks.filter(t => t.status === 'in-progress').length}

Provide analysis in JSON format:
{
  "healthScore": 0-100,
  "status": "healthy|at-risk|critical",
  "insights": ["insight1", "insight2"],
  "risks": ["risk1"],
  "recommendations": ["action1"]
}`;

    const response = await this.model.call([
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: prompt }
    ]);

    return JSON.parse(response.content);
  }

  async suggestTaskBreakdown(epicTask) {
    const prompt = `Break down this epic into smaller, actionable tasks:

Epic: ${epicTask.title}
Description: ${epicTask.description || 'No description'}

Create 3-5 subtasks that are:
- Specific and actionable
- Can be completed in 1-3 days

Return JSON array:
[{
  "title": "Task title",
  "description": "What needs to be done",
  "estimatedTime": 4,
  "priority": "medium"
}]`;

    const response = await this.model.call([
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: prompt }
    ]);

    return JSON.parse(response.content);
  }
}

module.exports = ProductManagerAgent;