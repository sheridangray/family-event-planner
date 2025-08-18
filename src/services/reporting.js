const fs = require('fs').promises;
const path = require('path');
const { GmailMCPClient } = require('../mcp/gmail');

class ReportingService {
  constructor(logger) {
    this.logger = logger;
    this.reportsDir = path.join(__dirname, '../../reports');
    this.gmailClient = new GmailMCPClient(logger);
    this.isGmailInitialized = false;
  }

  async ensureReportsDirectory() {
    try {
      await fs.access(this.reportsDir);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(this.reportsDir, { recursive: true });
      this.logger.info(`Created reports directory: ${this.reportsDir}`);
    }
  }

  async saveDailyReport(reportContent, date = new Date()) {
    try {
      await this.ensureReportsDirectory();
      
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      const filename = `daily-report-${dateStr}.txt`;
      const filepath = path.join(this.reportsDir, filename);
      
      // Add timestamp to report
      const timestampedReport = `Generated at: ${date.toISOString()}\n\n${reportContent}`;
      
      await fs.writeFile(filepath, timestampedReport, 'utf8');
      this.logger.info(`Daily report saved to: ${filepath}`);
      
      // Keep only the last 30 days of reports
      await this.cleanupOldReports();
      
      return filepath;
    } catch (error) {
      this.logger.error('Error saving daily report:', error.message);
      throw error;
    }
  }

  async cleanupOldReports(retentionDays = 30) {
    try {
      const files = await fs.readdir(this.reportsDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      let deletedCount = 0;
      
      for (const file of files) {
        if (file.startsWith('daily-report-') && file.endsWith('.txt')) {
          // Extract date from filename: daily-report-YYYY-MM-DD.txt
          const dateMatch = file.match(/daily-report-(\d{4}-\d{2}-\d{2})\.txt/);
          if (dateMatch) {
            const fileDate = new Date(dateMatch[1]);
            if (fileDate < cutoffDate) {
              const filepath = path.join(this.reportsDir, file);
              await fs.unlink(filepath);
              deletedCount++;
            }
          }
        }
      }
      
      if (deletedCount > 0) {
        this.logger.info(`Cleaned up ${deletedCount} old report files`);
      }
    } catch (error) {
      this.logger.warn('Error cleaning up old reports:', error.message);
    }
  }

  async getRecentReports(days = 7) {
    try {
      await this.ensureReportsDirectory();
      
      const files = await fs.readdir(this.reportsDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const recentReports = [];
      
      for (const file of files) {
        if (file.startsWith('daily-report-') && file.endsWith('.txt')) {
          const dateMatch = file.match(/daily-report-(\d{4}-\d{2}-\d{2})\.txt/);
          if (dateMatch) {
            const fileDate = new Date(dateMatch[1]);
            if (fileDate >= cutoffDate) {
              const filepath = path.join(this.reportsDir, file);
              const stats = await fs.stat(filepath);
              recentReports.push({
                filename: file,
                filepath: filepath,
                date: fileDate,
                size: stats.size,
                created: stats.birthtime
              });
            }
          }
        }
      }
      
      // Sort by date, newest first
      recentReports.sort((a, b) => b.date - a.date);
      
      return recentReports;
    } catch (error) {
      this.logger.error('Error getting recent reports:', error.message);
      return [];
    }
  }

  async readReport(filename) {
    try {
      const filepath = path.join(this.reportsDir, filename);
      const content = await fs.readFile(filepath, 'utf8');
      return content;
    } catch (error) {
      this.logger.error(`Error reading report ${filename}:`, error.message);
      throw error;
    }
  }

  async initializeGmail() {
    if (!this.isGmailInitialized) {
      try {
        await this.gmailClient.init();
        this.isGmailInitialized = true;
        this.logger.info('Gmail client initialized for email reports');
      } catch (error) {
        this.logger.warn('Gmail client initialization failed:', error.message);
        this.isGmailInitialized = false;
      }
    }
    return this.isGmailInitialized;
  }

  async emailReport(reportContent, recipients = []) {
    try {
      // Try to initialize Gmail if not already done
      const gmailReady = await this.initializeGmail();
      
      if (!gmailReady) {
        this.logger.warn('Gmail not available - saving report to file only');
        return {
          success: false,
          reason: 'Gmail not initialized',
          fallback: 'file_saved'
        };
      }

      // Send email using Gmail MCP client
      const result = await this.gmailClient.sendDailyReport(reportContent, recipients);
      
      if (result.success) {
        this.logger.info(`Daily report emailed successfully to: ${result.recipients.join(', ')}`);
        return {
          success: true,
          messageId: result.messageId,
          recipients: result.recipients
        };
      } else {
        this.logger.error(`Failed to send daily report email: ${result.error}`);
        return {
          success: false,
          reason: result.error,
          fallback: 'file_saved',
          recipients: result.recipients
        };
      }
      
    } catch (error) {
      this.logger.error('Error emailing report:', error.message);
      return {
        success: false,
        reason: error.message,
        fallback: 'file_saved'
      };
    }
  }

  async generateHealthSummary(healthScore) {
    try {
      const summary = `
=== System Health Summary ===
Overall Score: ${healthScore.score.toFixed(1)}% (${healthScore.description})

Component Health:
- Database: ${healthScore.details.database?.healthy ? '✅ Healthy' : '❌ Unhealthy'}
- Web Scrapers: ${healthScore.details.scrapers?.healthy ? '✅ Healthy' : '❌ Unhealthy'}
- MCP Services: ${healthScore.details.mcp?.healthy ? '✅ Healthy' : '❌ Unhealthy'}
  - Gmail: ${healthScore.details.mcp?.details?.gmail?.healthy ? '✅' : '❌'}
  - Twilio: ${healthScore.details.mcp?.details?.twilio?.healthy ? '✅' : '❌'}
- Automation: ${healthScore.details.automation?.healthy ? '✅ Healthy' : '❌ Unhealthy'}

${healthScore.score < 75 ? '⚠️ System performance may be degraded. Check individual components for issues.' : ''}
      `;
      
      return summary.trim();
    } catch (error) {
      this.logger.error('Error generating health summary:', error.message);
      return 'Health summary unavailable';
    }
  }
}

module.exports = ReportingService;