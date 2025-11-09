const { OpenAI } = require('openai');
const fs = require('fs');
const logger = require('../../src/utils/logger');

class WhisperService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.model = process.env.WHISPER_MODEL || 'whisper-1';
    this.maxFileSize = 25 * 1024 * 1024; // 25MB limit
  }

  async transcribe(audioFilePath, options = {}) {
    try {
      // Verify audio file exists
      if (!fs.existsSync(audioFilePath)) {
        throw new Error('Audio file not found');
      }

      // Check file size
      const stats = fs.statSync(audioFilePath);
      if (stats.size > this.maxFileSize) {
        throw new Error('File too large. Maximum size is 25MB');
      }

      logger.info(`Transcribing: ${audioFilePath}`);
      
      // Call OpenAI Whisper API
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(audioFilePath),
        model: this.model,
        language: options.language || process.env.WHISPER_LANGUAGE || 'en',
        response_format: options.format || 'verbose_json',
        temperature: options.temperature || 0
      });

      // Return structured transcription data
      return {
        text: transcription.text,
        segments: transcription.segments || [],
        duration: transcription.duration,
        language: transcription.language
      };
    } catch (error) {
      logger.error('Transcription error:', error);
      throw error;
    }
  }
}

module.exports = WhisperService;