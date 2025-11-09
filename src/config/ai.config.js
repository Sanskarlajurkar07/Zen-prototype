module.exports = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    temperature: 0.7,
    maxTokens: 2000
  },
  
  pinecone: {
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
    indexName: process.env.PINECONE_INDEX || 'zenai-embeddings'
  },

  whisper: {
    model: process.env.WHISPER_MODEL || 'whisper-1',
    language: process.env.WHISPER_LANGUAGE || 'en'
  },

  agents: {
    maxIterations: 5,
    timeout: 60000,
    verbose: process.env.NODE_ENV === 'development'
  },

  tools: {
    notion: {
      enabled: !!process.env.NOTION_API_KEY,
      apiKey: process.env.NOTION_API_KEY,
      databaseId: process.env.NOTION_DATABASE_ID
    },
    slack: {
      enabled: !!process.env.SLACK_BOT_TOKEN,
      botToken: process.env.SLACK_BOT_TOKEN,
      webhookUrl: process.env.SLACK_WEBHOOK_URL
    }
  }
};