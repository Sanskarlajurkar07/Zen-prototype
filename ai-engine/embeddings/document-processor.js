const { OpenAIEmbeddings } = require('@langchain/openai');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { Document } = require('langchain/document');
const logger = require('../../src/utils/logger');

class DocumentProcessor {
  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      modelName: process.env.EMBEDDING_MODEL || 'text-embedding-3-small'
    });

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200
    });

    this.documents = []; // In-memory storage (use Pinecone for production)
  }

  async initialize() {
    logger.info('Document processor initialized');
  }

  async indexDocument(content, metadata = {}) {
    try {
      const chunks = await this.textSplitter.splitText(content);

      const documents = chunks.map((chunk, index) => new Document({
        pageContent: chunk,
        metadata: {
          ...metadata,
          chunkIndex: index,
          totalChunks: chunks.length,
          timestamp: new Date().toISOString()
        }
      }));

      // Store in memory (replace with vector DB in production)
      this.documents.push(...documents);

      logger.info(`Indexed ${documents.length} document chunks`);
      return { success: true, chunks: documents.length };
    } catch (error) {
      logger.error('Document indexing error:', error);
      throw error;
    }
  }

  async similaritySearch(query, options = {}) {
    try {
      // Simple keyword search (replace with vector similarity in production)
      const limit = options.limit || 5;
      const filter = options.filter || {};

      const results = this.documents
        .filter(doc => {
          const matchesFilter = Object.keys(filter).every(
            key => doc.metadata[key] === filter[key]
          );
          const matchesQuery = doc.pageContent.toLowerCase().includes(query.toLowerCase());
          return matchesFilter && matchesQuery;
        })
        .slice(0, limit)
        .map(doc => ({
          content: doc.pageContent,
          metadata: doc.metadata,
          similarity: 0.8 // Mock similarity score
        }));

      return results;
    } catch (error) {
      logger.error('Similarity search error:', error);
      throw error;
    }
  }

  async indexProject(project, tasks) {
    const projectDoc = `
Project: ${project.name}
Description: ${project.description}
Status: ${project.status}
Priority: ${project.priority}
Tags: ${project.tags?.join(', ')}

Tasks:
${tasks.map(t => `- ${t.title}: ${t.description}`).join('\n')}
    `.trim();

    return await this.indexDocument(projectDoc, {
      type: 'project',
      projectId: project._id.toString(),
      projectName: project.name
    });
  }

  async searchProjectContext(query, projectId) {
    return await this.similaritySearch(query, {
      filter: {
        type: 'project',
        projectId
      },
      limit: 3
    });
  }
}

module.exports = DocumentProcessor;
