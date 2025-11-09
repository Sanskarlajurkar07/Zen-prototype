const { WebClient } = require('@slack/web-api');
const axios = require('axios');
const logger = require('../../src/utils/logger');

class SlackTool {
  constructor() {
    this.client = new WebClient(process.env.SLACK_BOT_TOKEN);
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
  }

  async sendMessage(channel, text, blocks = null) {
    try {
      const result = await this.client.chat.postMessage({
        channel,
        text,
        blocks
      });

      logger.info(`Slack message sent to ${channel}`);
      return result;
    } catch (error) {
      logger.error('Slack send message error:', error);
      throw error;
    }
  }

  async sendWebhook(text, blocks = null) {
    try {
      await axios.post(this.webhookUrl, {
        text,
        blocks
      });

      logger.info('Slack webhook sent');
    } catch (error) {
      logger.error('Slack webhook error:', error);
      throw error;
    }
  }

  async notifyTaskCreated(task, project) {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '✅ New Task Created'
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Task:*\n${task.title}`
          },
          {
            type: 'mrkdwn',
            text: `*Project:*\n${project.name}`
          },
          {
            type: 'mrkdwn',
            text: `*Priority:*\n${task.priority}`
          },
          {
            type: 'mrkdwn',
            text: `*Assignee:*\n${task.assignee || 'Unassigned'}`
          }
        ]
      }
    ];

    return await this.sendWebhook('New task created', blocks);
  }

  async notifyDeadlineApproaching(task, daysRemaining) {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⚠️ Deadline Approaching'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${task.title}* is due in *${daysRemaining} days*!`
        }
      }
    ];

    return await this.sendWebhook('Deadline approaching', blocks);
  }
}

module.exports = SlackTool;
