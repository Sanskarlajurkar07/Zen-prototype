const { Client } = require('@notionhq/client');
const logger = require('../../src/utils/logger');

class NotionTool {
  constructor() {
    this.notion = new Client({
      auth: process.env.NOTION_API_KEY
    });
    this.databaseId = process.env.NOTION_DATABASE_ID;
  }

  async createPage(data) {
    try {
      const response = await this.notion.pages.create({
        parent: { database_id: this.databaseId },
        properties: {
          Title: {
            title: [{ text: { content: data.title } }]
          },
          Description: {
            rich_text: [{ text: { content: data.description || '' } }]
          },
          Status: {
            select: { name: data.status || 'Not Started' }
          },
          Priority: {
            select: { name: data.priority || 'Medium' }
          },
          DueDate: data.dueDate ? {
            date: { start: data.dueDate }
          } : undefined
        }
      });

      logger.info(`Notion page created: ${response.id}`);
      return response;
    } catch (error) {
      logger.error('Notion create page error:', error);
      throw error;
    }
  }

  async updatePage(pageId, updates) {
    try {
      const properties = {};

      if (updates.status) {
        properties.Status = { select: { name: updates.status } };
      }
      if (updates.priority) {
        properties.Priority = { select: { name: updates.priority } };
      }

      await this.notion.pages.update({
        page_id: pageId,
        properties
      });

      logger.info(`Notion page updated: ${pageId}`);
    } catch (error) {
      logger.error('Notion update page error:', error);
      throw error;
    }
  }

  async syncTaskToNotion(task) {
    return await this.createPage({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate
    });
  }
}

module.exports = NotionTool;
