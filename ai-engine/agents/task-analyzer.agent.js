const BaseAgent = require('./base.agent');
const logger = require('../../src/utils/logger');

class TaskAnalyzerAgent extends BaseAgent {
  constructor() {
    super({
      name: 'TaskAnalyzerAgent',
      description: 'Analyzes tasks for complexity and dependencies',
      modelType: 'openai',
      temperature: 0.3,
      maxIterations: 3
    });
  }

  getSystemPrompt() {
    return `You are a Task Analysis Expert. You analyze tasks to:
- Estimate complexity and effort
- Identify dependencies and blockers
- Suggest optimal execution strategies
- Flag potential risks

Be precise and data-driven in your analysis.`;
  }

  async analyzeTask(task, projectContext) {
    const prompt = `Analyze this task in detail:

Task: ${task.title}
Description: ${task.description || 'No description'}

Provide comprehensive analysis:
{
  "complexityScore": 1-10,
  "estimatedHours": number,
  "skillsRequired": ["skill1", "skill2"],
  "dependencies": [],
  "risks": ["risk1"],
  "recommendations": ["rec1"]
}`;

    const response = await this.model.call([
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: prompt }
    ]);

    return JSON.parse(response.content);
  }
}

module.exports = TaskAnalyzerAgent;