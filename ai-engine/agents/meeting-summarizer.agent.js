const BaseAgent = require('./base.agent');
const WhisperService = require('../whisper/transcription.service');
const logger = require('../../src/utils/logger');

class MeetingSummarizerAgent extends BaseAgent {
  constructor() {
    super({
      name: 'MeetingSummarizerAgent',
      description: 'Transcribes meetings and generates summaries',
      modelType: 'openai',
      temperature: 0.3,
      maxTokens: 3000
    });

    this.whisperService = new WhisperService();
  }

  getSystemPrompt() {
    return `You are an expert meeting summarizer. You analyze meeting transcripts to:
- Extract key discussion points
- Identify decisions made
- List action items with owners
- Capture important questions

Format summaries professionally.`;
  }

  async transcribeAndSummarize(audioFilePath, meetingContext = {}) {
    try {
      console.log('Transcribing audio...');
      const transcription = await this.whisperService.transcribe(audioFilePath);

      console.log('Generating summary...');
      const summary = await this.generateSummary(transcription, meetingContext);

      console.log('Extracting action items...');
      const actionItems = await this.extractActionItems(transcription);

      return {
        transcription,
        summary,
        actionItems,
        metadata: {
          duration: transcription.duration,
          participants: meetingContext.participants || [],
          date: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Meeting summarization error:', error);
      throw error;
    }
  }

  async generateSummary(transcription, context) {
    const prompt = `Analyze this meeting transcript:

Meeting: ${context.title || 'Team Meeting'}
Transcript: ${transcription.text}

Generate structured summary:
{
  "executiveSummary": "2-3 sentence overview",
  "keyPoints": ["point1", "point2"],
  "decisions": ["decision1"],
  "nextSteps": ["step1"]
}`;

    const response = await this.model.call([
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: prompt }
    ]);

    return JSON.parse(response.content);
  }

  async extractActionItems(transcription) {
    const prompt = `Extract all action items from this transcript:

${transcription.text}

Return JSON:
[{
  "action": "Description",
  "owner": "Person or null",
  "dueDate": "Date or null",
  "priority": "high|medium|low"
}]`;

    const response = await this.model.call([
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: prompt }
    ]);

    return JSON.parse(response.content);
  }
}

module.exports = MeetingSummarizerAgent;