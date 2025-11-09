const { ChatOpenAI } = require('@langchain/openai');
const logger = require('../../src/utils/logger');

class BaseAgent {
  constructor(config) {
    this.name = config.name || 'BaseAgent';
    this.description = config.description || '';
    this.model = this.initializeModel(config);
    this.maxIterations = config.maxIterations || 5;
    this.verbose = config.verbose || false;
  }

  initializeModel(config) {
    const temperature = config.temperature || 0.7;
    const maxTokens = config.maxTokens || 2000;

    return new ChatOpenAI({
      modelName: config.modelName || process.env.OPENAI_MODEL,
      temperature,
      maxTokens,
      streaming: config.streaming || false
    });
  }

  async initialize() {
    logger.info(`${this.name} initialized`);
  }

  async chat(message) {
    const response = await this.model.call([
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: message }
    ]);

    return response.content;
  }

  getSystemPrompt() {
    return `You are ${this.name}. ${this.description}`;
  }
}

module.exports = BaseAgent;