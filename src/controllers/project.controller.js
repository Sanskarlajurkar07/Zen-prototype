const Project = require('../models/Project.model');
const Task = require('../models/Task.model');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

exports.createProject = async (req, res, next) => {
  try {
    const { name, description, team, deadline, priority, tags } = req.body;

    const project = await Project.create({
      name,
      description,
      owner: req.user.userId,
      team: team || [],
      deadline,
      priority,
      tags
    });

    await cache.clearPattern(`projects:${req.user.userId}:*`);

    logger.info(`Project created: ${project._id} by user: ${req.user.userId}`);

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: project
    });
  } catch (error) {
    next(error);
  }
};

exports.getProjects = async (req, res, next) => {
  try {
    const { status, priority, page = 1, limit = 10 } = req.query;
    const userId = req.user.userId;

    const cacheKey = `projects:${userId}:${status || 'all'}:${priority || 'all'}:${page}:${limit}`;
    
    let result = await cache.get(cacheKey);

    if (!result) {
      const query = {
        $or: [
          { owner: userId },
          { 'team.user': userId }
        ]
      };

      if (status) query.status = status;
      if (priority) query.priority = priority;

      const skip = (page - 1) * limit;

      const [projects, total] = await Promise.all([
        Project.find(query)
          .populate('owner', 'name email avatar')
          .populate('team.user', 'name email avatar')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Project.countDocuments(query)
      ]);

      result = {
        projects,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };

      await cache.set(cacheKey, result, 300);
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.getProjectById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const project = await Project.findById(id)
      .populate('owner', 'name email avatar')
      .populate('team.user', 'name email avatar');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const hasAccess = project.owner._id.toString() === req.user.userId ||
                      project.team.some(t => t.user._id.toString() === req.user.userId);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const tasks = await Task.find({ project: id })
      .populate('assignee', 'name email avatar')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        project,
        tasks
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (project.owner.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Only project owner can update'
      });
    }

    Object.assign(project, updates);
    await project.save();

    await cache.clearPattern(`projects:*`);

    res.json({
      success: true,
      message: 'Project updated successfully',
      data: project
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteProject = async (req, res, next) => {
  try {
    const { id } = req.params;

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (project.owner.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Only project owner can delete'
      });
    }

    await Task.deleteMany({ project: id });
    await project.deleteOne();

    await cache.clearPattern(`projects:*`);

    logger.info(`Project deleted: ${id} by user: ${req.user.userId}`);

    res.json({
      success: true,
      message: 'Project and all related tasks deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProgress = async (req, res, next) => {
  try {
    const { id } = req.params;

    const tasks = await Task.find({ project: id });
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
    
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const project = await Project.findByIdAndUpdate(
      id,
      {
        progress,
        'metadata.totalTasks': totalTasks,
        'metadata.completedTasks': completedTasks,
        'metadata.inProgressTasks': inProgressTasks
      },
      { new: true }
    );

    await cache.clearPattern(`projects:*`);

    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    next(error);
  }
};