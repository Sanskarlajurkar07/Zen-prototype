// AI Engine Entry Point
const ProductManagerAgent = require('./agents/product-manager.agent');
const TaskAnalyzerAgent = require('./agents/task-analyzer.agent');
const MeetingSummarizerAgent = require('./agents/meeting-summarizer.agent');
const BaseAgent = require('./agents/base.agent');

const NotionTool = require('./tools/notion.tool');
const SlackTool = require('./tools/slack.tool');

const DocumentProcessor = require('./embeddings/document-processor');
const WhisperService = require('./whisper/transcription.service');

module.exports = {
  // Agents
  ProductManagerAgent,
  TaskAnalyzerAgent,
  MeetingSummarizerAgent,
  BaseAgent,

  // Tools
  NotionTool,
  SlackTool,

  // Services
  DocumentProcessor,
  WhisperService
};
