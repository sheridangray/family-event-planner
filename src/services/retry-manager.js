class RetryManager {
  constructor(logger) {
    this.logger = logger;
    this.retryHistory = new Map(); // Track retry attempts per event
  }

  /**
   * Execute a registration attempt with intelligent retry logic
   */
  async executeWithRetry(operation, context, options = {}) {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 30000,
      backoffMultiplier = 2,
      jitter = true,
      retryableErrors = this.getDefaultRetryableErrors()
    } = options;

    const startTime = Date.now();
    const operationId = `${context.eventId}-${Date.now()}`;
    
    this.logger.debug(`Starting operation ${operationId} with retry support`);
    
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const attemptStart = Date.now();
      
      try {
        this.logger.debug(`Attempt ${attempt}/${maxRetries + 1} for ${context.eventTitle || context.eventId}`);
        
        // Execute the operation
        const result = await operation();
        
        // Success! Record metrics and return
        const totalTime = Date.now() - startTime;
        const attemptTime = Date.now() - attemptStart;
        
        await this.recordSuccess(context, {
          attempts: attempt,
          totalTime,
          attemptTime,
          operationId
        });
        
        this.logger.info(`Operation succeeded on attempt ${attempt} in ${totalTime}ms`);
        return result;
        
      } catch (error) {
        lastError = error;
        const attemptTime = Date.now() - attemptStart;
        
        this.logger.debug(`Attempt ${attempt} failed in ${attemptTime}ms: ${error.message}`);
        
        // Check if this is a retryable error
        const errorType = this.categorizeError(error);
        const isRetryable = retryableErrors.includes(errorType);
        
        this.logger.debug(`Error type: ${errorType}, Retryable: ${isRetryable}`);
        
        // Record attempt
        await this.recordAttempt(context, {
          attempt,
          errorType,
          errorMessage: error.message,
          attemptTime,
          isRetryable,
          operationId
        });
        
        // If not retryable or we've exhausted retries, fail immediately
        if (!isRetryable || attempt > maxRetries) {
          const totalTime = Date.now() - startTime;
          
          await this.recordFailure(context, {
            attempts: attempt,
            totalTime,
            finalError: error.message,
            finalErrorType: errorType,
            operationId
          });
          
          this.logger.warn(`Operation failed permanently after ${attempt} attempts in ${totalTime}ms`);
          throw error;
        }
        
        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, baseDelay, maxDelay, backoffMultiplier, jitter);
        
        this.logger.debug(`Waiting ${delay}ms before attempt ${attempt + 1}`);
        await this.sleep(delay);
      }
    }
    
    // This shouldn't be reached, but just in case
    throw lastError;
  }

  /**
   * Categorize errors for retry decision making
   */
  categorizeError(error) {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';
    
    // Network/connectivity issues - always retry
    if (message.includes('timeout') || message.includes('network') || 
        message.includes('connection') || message.includes('econnreset') ||
        message.includes('enotfound') || message.includes('econnrefused')) {
      return 'network_error';
    }
    
    // Server errors (5xx) - retry
    if (message.includes('500') || message.includes('502') || 
        message.includes('503') || message.includes('504') ||
        message.includes('server error')) {
      return 'server_error';
    }
    
    // Rate limiting - retry with longer delays
    if (message.includes('rate limit') || message.includes('429') ||
        message.includes('too many requests')) {
      return 'rate_limit';
    }
    
    // Browser/page issues - retry
    if (message.includes('page crash') || message.includes('browser') ||
        message.includes('navigation') || stack.includes('puppeteer')) {
      return 'browser_error';
    }
    
    // Site temporarily unavailable - retry
    if (message.includes('maintenance') || message.includes('unavailable') ||
        message.includes('temporarily') || message.includes('down')) {
      return 'site_unavailable';
    }
    
    // Client errors (4xx) - usually don't retry
    if (message.includes('400') || message.includes('401') || 
        message.includes('403') || message.includes('404') ||
        message.includes('bad request') || message.includes('unauthorized')) {
      return 'client_error';
    }
    
    // Registration-specific errors - don't retry
    if (message.includes('sold out') || message.includes('full') ||
        message.includes('closed') || message.includes('expired')) {
      return 'registration_closed';
    }
    
    // Unknown errors - cautiously retry
    return 'unknown_error';
  }

  /**
   * Get default list of retryable error types
   */
  getDefaultRetryableErrors() {
    return [
      'network_error',
      'server_error', 
      'rate_limit',
      'browser_error',
      'site_unavailable',
      'unknown_error' // Be cautious and retry unknown errors
    ];
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  calculateDelay(attempt, baseDelay, maxDelay, multiplier, useJitter) {
    // Exponential backoff: delay = baseDelay * (multiplier ^ (attempt - 1))
    let delay = baseDelay * Math.pow(multiplier, attempt - 1);
    
    // Cap at maximum delay
    delay = Math.min(delay, maxDelay);
    
    // Add jitter to prevent thundering herd
    if (useJitter) {
      // Random jitter between 50% and 100% of calculated delay
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.round(delay);
  }

  /**
   * Record successful operation
   */
  async recordSuccess(context, metrics) {
    try {
      const record = {
        eventId: context.eventId,
        operationType: 'registration_attempt',
        result: 'success',
        attempts: metrics.attempts,
        totalTimeMs: metrics.totalTime,
        finalAttemptTimeMs: metrics.attemptTime,
        adapterUsed: context.adapterName,
        operationId: metrics.operationId,
        createdAt: new Date()
      };
      
      // Store in retry history for learning
      this.retryHistory.set(context.eventId, {
        ...record,
        success: true
      });
      
      this.logger.debug(`Recorded successful operation: ${JSON.stringify(record)}`);
      
    } catch (error) {
      this.logger.warn('Failed to record success metrics:', error.message);
    }
  }

  /**
   * Record failed operation
   */
  async recordFailure(context, metrics) {
    try {
      const record = {
        eventId: context.eventId,
        operationType: 'registration_attempt',
        result: 'failure',
        attempts: metrics.attempts,
        totalTimeMs: metrics.totalTime,
        finalError: metrics.finalError,
        finalErrorType: metrics.finalErrorType,
        adapterUsed: context.adapterName,
        operationId: metrics.operationId,
        createdAt: new Date()
      };
      
      // Store in retry history for learning
      this.retryHistory.set(context.eventId, {
        ...record,
        success: false
      });
      
      this.logger.debug(`Recorded failed operation: ${JSON.stringify(record)}`);
      
    } catch (error) {
      this.logger.warn('Failed to record failure metrics:', error.message);
    }
  }

  /**
   * Record individual attempt
   */
  async recordAttempt(context, metrics) {
    try {
      this.logger.debug(`Attempt ${metrics.attempt}: ${metrics.errorType} - ${metrics.errorMessage}`);
    } catch (error) {
      this.logger.warn('Failed to record attempt:', error.message);
    }
  }

  /**
   * Get retry recommendations based on historical data
   */
  getRetryRecommendations(eventId, adapterName, errorType) {
    const recommendations = {
      maxRetries: 3,
      baseDelay: 1000,
      shouldRetry: true
    };
    
    // Adjust based on error type
    switch (errorType) {
      case 'rate_limit':
        recommendations.maxRetries = 5;
        recommendations.baseDelay = 5000; // Longer delays for rate limiting
        break;
        
      case 'network_error':
        recommendations.maxRetries = 4;
        recommendations.baseDelay = 2000;
        break;
        
      case 'server_error':
        recommendations.maxRetries = 3;
        recommendations.baseDelay = 3000;
        break;
        
      case 'browser_error':
        recommendations.maxRetries = 2;
        recommendations.baseDelay = 5000; // Browser restarts take time
        break;
        
      case 'client_error':
      case 'registration_closed':
        recommendations.shouldRetry = false;
        recommendations.maxRetries = 0;
        break;
    }
    
    return recommendations;
  }

  /**
   * Check if an event should be retried based on recent history
   */
  shouldRetryEvent(eventId, adapterName) {
    const recentHistory = this.retryHistory.get(eventId);
    
    if (!recentHistory) {
      return true; // No history, try it
    }
    
    // Don't retry if we just failed very recently (within 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (recentHistory.createdAt > fiveMinutesAgo && !recentHistory.success) {
      this.logger.debug(`Skipping retry for ${eventId} - recently failed`);
      return false;
    }
    
    return true;
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get retry statistics for monitoring
   */
  getRetryStats() {
    const stats = {
      totalOperations: this.retryHistory.size,
      successfulOperations: 0,
      failedOperations: 0,
      averageAttempts: 0,
      averageSuccessTime: 0,
      commonErrorTypes: {}
    };
    
    let totalAttempts = 0;
    let totalSuccessTime = 0;
    let successCount = 0;
    
    for (const [eventId, record] of this.retryHistory.entries()) {
      totalAttempts += record.attempts;
      
      if (record.success) {
        stats.successfulOperations++;
        totalSuccessTime += record.totalTimeMs;
        successCount++;
      } else {
        stats.failedOperations++;
        
        // Track error types
        const errorType = record.finalErrorType || 'unknown';
        stats.commonErrorTypes[errorType] = (stats.commonErrorTypes[errorType] || 0) + 1;
      }
    }
    
    stats.averageAttempts = stats.totalOperations > 0 ? totalAttempts / stats.totalOperations : 0;
    stats.averageSuccessTime = successCount > 0 ? totalSuccessTime / successCount : 0;
    
    return stats;
  }

  /**
   * Clear old retry history to prevent memory leaks
   */
  cleanupHistory(maxAgeHours = 24) {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    let removed = 0;
    
    for (const [eventId, record] of this.retryHistory.entries()) {
      if (record.createdAt < cutoffTime) {
        this.retryHistory.delete(eventId);
        removed++;
      }
    }
    
    if (removed > 0) {
      this.logger.debug(`Cleaned up ${removed} old retry history records`);
    }
  }
}

module.exports = RetryManager;