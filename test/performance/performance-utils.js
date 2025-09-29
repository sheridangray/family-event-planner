/**
 * Performance Testing Utilities for Family Event Planner
 * 
 * Comprehensive performance monitoring and load testing tools
 */

const { performance } = require('perf_hooks');

class PerformanceMonitor {
  constructor() {
    this.measurements = new Map();
    this.resources = new Map();
    this.baselineMemory = process.memoryUsage();
  }

  /**
   * Start timing a named operation
   */
  startTimer(name) {
    this.measurements.set(name, {
      start: performance.now(),
      memory: process.memoryUsage()
    });
  }

  /**
   * End timing and return duration
   */
  endTimer(name) {
    const measurement = this.measurements.get(name);
    if (!measurement) {
      throw new Error(`No timer started for: ${name}`);
    }

    const end = performance.now();
    const duration = end - measurement.start;
    const memoryEnd = process.memoryUsage();
    
    const result = {
      duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
      memoryDelta: {
        heapUsed: memoryEnd.heapUsed - measurement.memory.heapUsed,
        heapTotal: memoryEnd.heapTotal - measurement.memory.heapTotal,
        external: memoryEnd.external - measurement.memory.external,
        rss: memoryEnd.rss - measurement.memory.rss
      },
      memoryEnd
    };

    this.measurements.delete(name);
    return result;
  }

  /**
   * Measure an async operation
   */
  async measure(name, operation) {
    this.startTimer(name);
    try {
      const result = await operation();
      const metrics = this.endTimer(name);
      
      console.log(`📊 ${name}: ${metrics.duration}ms, Memory: ${this.formatMemory(metrics.memoryDelta.heapUsed)}`);
      
      return { result, metrics };
    } catch (error) {
      this.endTimer(name); // Clean up timer
      throw error;
    }
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage() {
    const current = process.memoryUsage();
    return {
      current,
      delta: {
        heapUsed: current.heapUsed - this.baselineMemory.heapUsed,
        heapTotal: current.heapTotal - this.baselineMemory.heapTotal,
        external: current.external - this.baselineMemory.external,
        rss: current.rss - this.baselineMemory.rss
      }
    };
  }

  /**
   * Track resource usage over time
   */
  trackResources(name, interval = 1000, duration = 60000) {
    const startTime = Date.now();
    const resourceData = [];

    const tracker = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const memory = process.memoryUsage();
      
      resourceData.push({
        timestamp: elapsed,
        memory,
        cpuUsage: process.cpuUsage()
      });

      if (elapsed >= duration) {
        clearInterval(tracker);
        this.resources.set(name, resourceData);
      }
    }, interval);

    return new Promise((resolve) => {
      setTimeout(() => {
        clearInterval(tracker);
        this.resources.set(name, resourceData);
        resolve(resourceData);
      }, duration);
    });
  }

  /**
   * Format memory usage for display
   */
  formatMemory(bytes) {
    const mb = bytes / 1024 / 1024;
    return `${mb > 0 ? '+' : ''}${mb.toFixed(2)}MB`;
  }

  /**
   * Generate performance report
   */
  generateReport(name) {
    const resourceData = this.resources.get(name);
    if (!resourceData || resourceData.length === 0) {
      return null;
    }

    const memoryValues = resourceData.map(d => d.memory.heapUsed);
    const maxMemory = Math.max(...memoryValues);
    const minMemory = Math.min(...memoryValues);
    const avgMemory = memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length;
    const memoryGrowth = memoryValues[memoryValues.length - 1] - memoryValues[0];

    return {
      name,
      duration: resourceData[resourceData.length - 1].timestamp,
      memory: {
        max: maxMemory,
        min: minMemory,
        average: avgMemory,
        growth: memoryGrowth,
        maxFormatted: this.formatMemory(maxMemory),
        growthFormatted: this.formatMemory(memoryGrowth)
      },
      dataPoints: resourceData.length
    };
  }

  /**
   * Reset baseline memory
   */
  resetBaseline() {
    this.baselineMemory = process.memoryUsage();
  }
}

class LoadGenerator {
  constructor() {
    this.activeTasks = new Set();
  }

  /**
   * Generate concurrent load
   */
  async generateLoad(operation, concurrency, totalOperations) {
    const results = [];
    const errors = [];
    const startTime = performance.now();

    // Create batches of concurrent operations
    const batches = Math.ceil(totalOperations / concurrency);
    
    for (let batch = 0; batch < batches; batch++) {
      const batchSize = Math.min(concurrency, totalOperations - (batch * concurrency));
      const batchPromises = [];

      for (let i = 0; i < batchSize; i++) {
        const operationId = (batch * concurrency) + i;
        const promise = this.executeWithMetrics(operation, operationId);
        batchPromises.push(promise);
        this.activeTasks.add(promise);
      }

      // Wait for batch to complete
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        const operationId = (batch * concurrency) + index;
        if (result.status === 'fulfilled') {
          results.push({ operationId, ...result.value });
        } else {
          errors.push({ operationId, error: result.reason });
        }
      });

      // Clean up completed tasks
      batchPromises.forEach(promise => this.activeTasks.delete(promise));
    }

    const totalTime = performance.now() - startTime;

    return {
      totalTime: Math.round(totalTime * 100) / 100,
      totalOperations,
      successful: results.length,
      failed: errors.length,
      successRate: (results.length / totalOperations) * 100,
      averageTime: results.length > 0 ? results.reduce((sum, r) => sum + r.duration, 0) / results.length : 0,
      results,
      errors
    };
  }

  /**
   * Execute operation with performance metrics
   */
  async executeWithMetrics(operation, operationId) {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    try {
      const result = await operation(operationId);
      const endTime = performance.now();
      const endMemory = process.memoryUsage();

      return {
        duration: Math.round((endTime - startTime) * 100) / 100,
        memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
        success: true,
        result
      };
    } catch (error) {
      const endTime = performance.now();
      return {
        duration: Math.round((endTime - startTime) * 100) / 100,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Stop all active operations
   */
  async stopAll() {
    // Note: This doesn't actually cancel promises, but tracks them
    return Promise.allSettled(Array.from(this.activeTasks));
  }
}

class DatabasePerformanceAnalyzer {
  constructor(database, logger) {
    this.database = database;
    this.logger = logger;
    this.queryMetrics = new Map();
  }

  /**
   * Analyze query performance
   */
  async analyzeQuery(name, query, params = []) {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    try {
      const result = await this.database.query(query, params);
      const endTime = performance.now();
      const endMemory = process.memoryUsage();

      const metrics = {
        duration: Math.round((endTime - startTime) * 100) / 100,
        rowCount: result.rows ? result.rows.length : 0,
        memoryUsed: endMemory.heapUsed - startMemory.heapUsed,
        query: query.replace(/\s+/g, ' ').trim(),
        timestamp: new Date()
      };

      this.queryMetrics.set(name, metrics);
      
      if (this.logger) {
        this.logger.info(`Query ${name}: ${metrics.duration}ms, ${metrics.rowCount} rows`);
      }

      return { result, metrics };
    } catch (error) {
      const endTime = performance.now();
      const metrics = {
        duration: Math.round((endTime - startTime) * 100) / 100,
        error: error.message,
        query: query.replace(/\s+/g, ' ').trim(),
        timestamp: new Date()
      };

      this.queryMetrics.set(name, metrics);
      throw error;
    }
  }

  /**
   * Test query performance under load
   */
  async loadTestQuery(name, query, params = [], concurrency = 10, iterations = 100) {
    const loadGenerator = new LoadGenerator();
    
    const operation = async (operationId) => {
      return await this.analyzeQuery(`${name}_${operationId}`, query, params);
    };

    return await loadGenerator.generateLoad(operation, concurrency, iterations);
  }

  /**
   * Get query performance summary
   */
  getQuerySummary() {
    const metrics = Array.from(this.queryMetrics.values());
    
    if (metrics.length === 0) {
      return { totalQueries: 0 };
    }

    const durations = metrics.filter(m => !m.error).map(m => m.duration);
    const errors = metrics.filter(m => m.error);

    return {
      totalQueries: metrics.length,
      successful: durations.length,
      failed: errors.length,
      averageDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
      slowQueries: metrics.filter(m => m.duration > 1000), // Queries over 1 second
      errors: errors.map(e => ({ query: e.query, error: e.error }))
    };
  }
}

// Global performance testing utilities
global.PerformanceMonitor = PerformanceMonitor;
global.LoadGenerator = LoadGenerator;
global.DatabasePerformanceAnalyzer = DatabasePerformanceAnalyzer;

// Helper functions for common performance testing patterns
global.measureAsync = async (name, operation) => {
  const monitor = new PerformanceMonitor();
  return await monitor.measure(name, operation);
};

global.generateDatabaseLoad = async (database, query, params, concurrency, iterations) => {
  const analyzer = new DatabasePerformanceAnalyzer(database);
  return await analyzer.loadTestQuery('load_test', query, params, concurrency, iterations);
};

global.trackMemoryUsage = (name, duration = 60000) => {
  const monitor = new PerformanceMonitor();
  return monitor.trackResources(name, 1000, duration);
};

// Export for module usage
module.exports = {
  PerformanceMonitor,
  LoadGenerator,
  DatabasePerformanceAnalyzer
};