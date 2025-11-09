const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { aiLimiter } = require('../middleware/rateLimiter.middleware');

router.use(authenticate);

router.post('/chat', aiLimiter, aiController.chat);
router.get('/chat/history', aiController.getChatHistory);
router.post('/suggestions/tasks', aiController.generateTaskSuggestions);
router.get('/analysis/project/:id', aiController.analyzeProject);
router.post('/transcribe-meeting', aiController.transcribeMeeting);

module.exports = router;