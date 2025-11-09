require('dotenv').config();
const http = require('http');
const app = require('./app');
const logger = require('./utils/logger');
const { initializeWebSocket } = require('./websocket/socketHandler');
const aiOrchestrator = require('./services/ai-orchestrator.service');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize WebSocket
initializeWebSocket(server);

async function startServer() {
  try {
    let aiEnabled = false;
    
    // Try to initialize AI Engine
    if (process.env.OPENAI_API_KEY) {
      try {
        await aiOrchestrator.initialize();
        aiEnabled = true;
      } catch (error) {
        logger.warn('⚠️ AI Engine initialization failed, server will run without AI features');
        logger.warn(error.message);
      }
    } else {
      logger.warn('⚠️ OPENAI_API_KEY not found, AI features disabled');
    }

    // Start server
    server.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
      console.log(`\n🚀 ZenAI Server is running!`);
      console.log(`📡 API: http://localhost:${PORT}`);
      console.log(`📚 Health: http://localhost:${PORT}/health`);
      console.log(`🤖 AI Engine: ${aiEnabled ? '✅ Enabled' : '❌ Disabled'}`);
      console.log(`\n💡 Press Ctrl+C to stop\n`);
    });
  } catch (error) {
    logger.error('Server startup failed:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});