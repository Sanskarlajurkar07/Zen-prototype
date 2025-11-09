const Task = require('../models/Task.model');
const Project = require('../models/Project.model');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

exports.createTask = async (req, res, next) => {
  try {
    const taskData = req.body;
    taskData.createdBy = req.user.userId;

    const task = await Task.create(taskData);

    await this.updateProjectProgress(taskData.project);

    logger.info(`Task created: ${task._id}`);

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: task
    });
  } catch (error) {
    next(error);
  }
};

exports.getTasks = async (req, res, next) => {
  try {
    const { projectId, status, priority, assignee, page = 1, limit = 20 } = req.query;

    const query = {};
    if (projectId) query.project = projectId;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignee) query.assignee = assignee;

    const skip = (page - 1) * limit;

    const [tasks, total] = await Promise.all([
      Task.find(query)
        .populate('project', 'name')
        .populate('assignee', 'name email avatar')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Task.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        tasks,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getTaskById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const task = await Task.findById(id)
      .populate('project', 'name owner')
      .populate('assignee', 'name email avatar')
      .populate('createdBy', 'name email')
      .populate('dependencies');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    next(error);
  }
};

exports.updateTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const task = await Task.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    await this.updateProjectProgress(task.project);

    res.json({
      success: true,
      message: 'Task updated successfully',
      data: task
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteTask = async (req, res, next) => {
  try {
    const { id } = req.params;

    const task = await Task.findByIdAndDelete(id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    await this.updateProjectProgress(task.project);

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const task = await Task.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    await this.updateProjectProgress(task.project);

    res.json({
      success: true,
      message: 'Task status updated',
      data: task
    });
  } catch (error) {
    next(error);
  }
};

exports.addComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    task.comments.push({
      user: req.user.userId,
      text,
      createdAt: new Date()
    });

    await task.save();

    res.json({
      success: true,
      message: 'Comment added',
      data: task
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProjectProgress = async (projectId) => {
  try {
    const tasks = await Task.find({ project: projectId });
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
    
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    await Project.findByIdAndUpdate(projectId, {
      progress,
      'metadata.totalTasks': totalTasks,
      'metadata.completedTasks': completedTasks,
      'metadata.inProgressTasks': inProgressTasks
    });

    await cache.clearPattern(`projects:*`);
  } catch (error) {
    logger.error('Project progress update error:', error);
  }
};
