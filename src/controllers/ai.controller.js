const aiOrchestrator = require('../services/ai-orchestrator.service');
const ChatMessage = require('../models/ChatMessage.model');
const Project = require('../models/Project.model');
const Task = require('../models/Task.model');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const upload = multer({
  dest: 'uploads/meetings/',
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp3|wav|m4a|mp4|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only audio files are allowed'));
  }
});

exports.chat = async (req, res, next) => {
  try {
    const { message, projectId } = req.body;
    const userId = req.user.userId;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    await aiOrchestrator.initialize();

    const result = await aiOrchestrator.chat(userId, message, {
      projectId,
      userId
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Chat endpoint error:', error);
    next(error);
  }
};

exports.getChatHistory = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { limit = 50, projectId } = req.query;

    const query = { user: userId };
    if (projectId) {
      query['context.projectId'] = projectId;
    }

    const messages = await ChatMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: messages.reverse()
    });
  } catch (error) {
    next(error);
  }
};

exports.generateTaskSuggestions = async (req, res, next) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }

    await aiOrchestrator.initialize();

    const result = await aiOrchestrator.generateTaskSuggestions(projectId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.analyzeProject = async (req, res, next) => {
  try {
    const { id } = req.params;

    await aiOrchestrator.initialize();

    const result = await aiOrchestrator.handleProjectAnalysis({
      projectId: id
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.transcribeMeeting = [
  upload.single('audio'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Audio file is required'
        });
      }

      const { projectId, title, participants } = req.body;

      await aiOrchestrator.initialize();

      const result = await aiOrchestrator.transcribeMeeting(req.file.path, {
        projectId,
        userId: req.user.userId,
        title: title || 'Team Meeting',
        participants: participants ? JSON.parse(participants) : []
      });

      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      next(error);
    }
  }
];