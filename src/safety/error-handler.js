const fs = require('fs');
const path = require('path');

class ErrorHandler {
  constructor(logger) {
    this.logger = logger;
    this.errorLog = [];
    this.maxLogSize = 1000;
    this.errorFilePath = path.join(__dirname, '../../logs/errors.json');
    this.criticalErrors = [];
  }

  handleError(error, context = {}) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      context,
      severity: this.determineSeverity(error, context),
      handled: true
    };

    this.errorLog.push(errorEntry);
    
    if (errorEntry.severity === 'critical') {
      this.criticalErrors.push(errorEntry);
      this.handleCriticalError(errorEntry);
    }

    this.logger.error(`Error in ${context.component || 'unknown'}:`, {
      message: error.message,
      context,
      severity: errorEntry.severity
    });

    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-500);
    }

    this.saveErrorLog();
    
    return errorEntry;
  }

  determineSeverity(error, context) {
    const message = error.message.toLowerCase();
    
    if (message.includes('payment') || message.includes('credit') || message.includes('safety violation')) {
      return 'critical';
    }
    
    if (context.component === 'database' || message.includes('database')) {
      return 'high';
    }
    
    if (context.component === 'mcp' || message.includes('mcp')) {
      return 'high';
    }
    
    if (message.includes('timeout') || message.includes('network')) {
      return 'medium';
    }
    
    if (context.component === 'scraper') {
      return 'medium';
    }
    
    return 'low';
  }

  handleCriticalError(errorEntry) {
    this.logger.error('CRITICAL ERROR DETECTED:', errorEntry);
    
    if (errorEntry.message.includes('payment') || errorEntry.message.includes('safety violation')) {
      this.emergencyShutdown('Payment safety violation detected');
    }
  }

  emergencyShutdown(reason) {
    this.logger.error(`EMERGENCY SHUTDOWN: ${reason}`);
    
    // Save critical state
    this.saveErrorLog();
    
    // Attempt to notify administrators (would implement actual notification)
    this.logger.error('EMERGENCY SHUTDOWN INITIATED - MANUAL INTERVENTION REQUIRED');
    
    // In a real implementation, this might:
    // 1. Send emergency alerts
    // 2. Disable automation systems
    // 3. Create incident reports
    // 4. Stop all scheduled tasks
    
    process.exit(1);
  }

  saveErrorLog() {
    try {
      const logData = {
        lastUpdated: new Date().toISOString(),
        errorCount: this.errorLog.length,
        criticalCount: this.criticalErrors.length,
        errors: this.errorLog.slice(-100) // Save last 100 errors
      };
      
      fs.writeFileSync(this.errorFilePath, JSON.stringify(logData, null, 2));
    } catch (error) {
      this.logger.error('Failed to save error log:', error.message);
    }
  }

  loadErrorLog() {
    try {
      if (fs.existsSync(this.errorFilePath)) {
        const logData = JSON.parse(fs.readFileSync(this.errorFilePath, 'utf8'));
        this.errorLog = logData.errors || [];
        this.logger.info(`Loaded ${this.errorLog.length} previous errors from log`);
      }
    } catch (error) {
      this.logger.warn('Failed to load previous error log:', error.message);
    }
  }

  wrapAsync(asyncFunction, context = {}) {
    return async (...args) => {
      try {
        return await asyncFunction(...args);
      } catch (error) {
        this.handleError(error, context);
        throw error;
      }
    };
  }

  wrapSync(syncFunction, context = {}) {
    return (...args) => {
      try {
        return syncFunction(...args);
      } catch (error) {
        this.handleError(error, context);
        throw error;
      }
    };
  }

  createSafeWrapper(component) {
    return {
      async: (fn) => this.wrapAsync(fn, { component }),
      sync: (fn) => this.wrapSync(fn, { component })
    };
  }

  getErrorStats() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentErrors = this.errorLog.filter(e => new Date(e.timestamp) > oneHourAgo);
    const dailyErrors = this.errorLog.filter(e => new Date(e.timestamp) > oneDayAgo);

    const severityCounts = this.errorLog.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {});

    return {
      total: this.errorLog.length,
      critical: this.criticalErrors.length,
      lastHour: recentErrors.length,
      lastDay: dailyErrors.length,
      bySeverity: severityCounts,
      components: this.getComponentErrorCounts()
    };
  }

  getComponentErrorCounts() {
    return this.errorLog.reduce((acc, error) => {
      const component = error.context.component || 'unknown';
      acc[component] = (acc[component] || 0) + 1;
      return acc;
    }, {});
  }

  clearOldErrors(days = 30) {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const initialCount = this.errorLog.length;
    
    this.errorLog = this.errorLog.filter(error => new Date(error.timestamp) > cutoffDate);
    this.criticalErrors = this.criticalErrors.filter(error => new Date(error.timestamp) > cutoffDate);
    
    const removedCount = initialCount - this.errorLog.length;
    this.logger.info(`Cleared ${removedCount} errors older than ${days} days`);
    
    this.saveErrorLog();
    return removedCount;
  }

  getRecentCriticalErrors(hours = 24) {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.criticalErrors.filter(error => new Date(error.timestamp) > cutoffTime);
  }

  // Graceful degradation helpers
  withFallback(primaryFunction, fallbackFunction, context = {}) {
    return async (...args) => {
      try {
        return await primaryFunction(...args);
      } catch (error) {
        this.handleError(error, { ...context, fallbackUsed: true });
        this.logger.warn(`Primary function failed, using fallback: ${error.message}`);
        return await fallbackFunction(...args);
      }
    };
  }

  withRetry(fn, maxRetries = 3, delay = 1000, context = {}) {
    return async (...args) => {
      let lastError;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await fn(...args);
        } catch (error) {
          lastError = error;
          this.handleError(error, { ...context, attempt, maxRetries });
          
          if (attempt < maxRetries) {
            this.logger.info(`Retrying in ${delay}ms... (attempt ${attempt}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 1.5; // Exponential backoff
          }
        }
      }
      
      throw lastError;
    };
  }

  isHealthy() {
    const recentCritical = this.getRecentCriticalErrors(1);
    const recentErrors = this.errorLog.filter(e => 
      new Date(e.timestamp) > new Date(Date.now() - 60 * 60 * 1000)
    );
    
    return {
      healthy: recentCritical.length === 0 && recentErrors.length < 10,
      criticalErrors: recentCritical.length,
      recentErrors: recentErrors.length,
      status: recentCritical.length > 0 ? 'critical' : 
              recentErrors.length > 20 ? 'degraded' : 'healthy'
    };
  }
}

module.exports = ErrorHandler;