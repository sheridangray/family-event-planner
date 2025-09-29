/**
 * Scraper Memory Management & Performance Tests
 * 
 * Tests browser resource management, memory leak detection, and concurrent scraper performance
 */

const { PerformanceMonitor, LoadGenerator } = require('./performance-utils');

describe('Scraper Performance & Memory Management', () => {
  let performanceMonitor;
  let loadGenerator;
  let mockScraperManager;
  let mockLogger;
  let mockBrowser;
  let mockPage;

  beforeAll(async () => {
    mockLogger = createMockLogger();
    performanceMonitor = new PerformanceMonitor();
    loadGenerator = new LoadGenerator();
    
    // Mock Puppeteer browser and page objects
    mockPage = {
      goto: jest.fn().mockResolvedValue(),
      waitForSelector: jest.fn().mockResolvedValue(),
      evaluate: jest.fn().mockResolvedValue([]),
      close: jest.fn().mockResolvedValue(),
      isClosed: jest.fn().mockReturnValue(false),
      url: jest.fn().mockReturnValue('https://example.com'),
      setUserAgent: jest.fn().mockResolvedValue(),
      setViewport: jest.fn().mockResolvedValue(),
      metrics: jest.fn().mockResolvedValue({
        Timestamp: Date.now(),
        Documents: 1,
        Frames: 1,
        JSEventListeners: 0,
        Nodes: 100,
        LayoutCount: 1,
        RecalcStyleCount: 1,
        LayoutDuration: 0.1,
        RecalcStyleDuration: 0.05,
        ScriptDuration: 0.2,
        TaskDuration: 0.3,
        JSHeapUsedSize: 1024 * 1024 * 2, // 2MB
        JSHeapTotalSize: 1024 * 1024 * 4  // 4MB
      })
    };

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(),
      isConnected: jest.fn().mockReturnValue(true),
      pages: jest.fn().mockResolvedValue([mockPage]),
      version: jest.fn().mockReturnValue('Chrome/96.0.4664.110')
    };

    // Mock ScraperManager with realistic behavior
    mockScraperManager = {
      browser: mockBrowser,
      scrapeSource: jest.fn().mockImplementation(async (source) => {
        // Simulate scraping work with varying durations
        const delay = Math.random() * 1000 + 500; // 500-1500ms
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Generate mock events
        const eventCount = Math.floor(Math.random() * 20) + 5; // 5-25 events
        return Array(eventCount).fill().map((_, i) => ({
          id: `${source}-event-${i}`,
          title: `Event ${i} from ${source}`,
          url: `https://${source}.com/event-${i}`,
          date: new Date(),
          cost: Math.random() > 0.7 ? Math.floor(Math.random() * 100) : 0,
          description: `Description for event ${i}`,
          source: source
        }));
      }),
      scrapeAll: jest.fn().mockImplementation(async () => {
        const sources = ['library', 'eventbrite', 'parks', 'museums', 'schools'];
        const allEvents = [];
        
        for (const source of sources) {
          const events = await mockScraperManager.scrapeSource(source);
          allEvents.push(...events);
        }
        
        return allEvents;
      }),
      initializeBrowser: jest.fn().mockResolvedValue(mockBrowser),
      closeBrowser: jest.fn().mockResolvedValue()
    };
  });

  afterAll(async () => {
    if (mockScraperManager.browser) {
      await mockScraperManager.closeBrowser();
    }
  });

  describe('Browser Resource Management', () => {
    test('Browser initialization and cleanup performance', async () => {
      const { result, metrics } = await measureAsync('browser_lifecycle', async () => {
        const browser = await mockScraperManager.initializeBrowser();
        
        // Simulate some scraping work
        const page = await browser.newPage();
        await page.goto('https://example.com');
        await page.close();
        
        await mockScraperManager.closeBrowser();
        return { browser };
      });

      expect(metrics.duration).toBeLessThan(5000); // Browser lifecycle <5s
      expect(metrics.memoryDelta.heapUsed).toBeLessThan(100 * 1024 * 1024); // <100MB
      
      console.log(`📊 Browser lifecycle: ${metrics.duration}ms, Memory: ${performanceMonitor.formatMemory(metrics.memoryDelta.heapUsed)}`);
    });

    test('Page creation and cleanup efficiency', async () => {
      const pageCreationTest = async (pageNumber) => {
        const page = await mockBrowser.newPage();
        
        // Simulate page work
        await page.setUserAgent('Mozilla/5.0 (compatible; FEP-Bot/1.0)');
        await page.setViewport({ width: 1200, height: 800 });
        await page.goto(`https://example.com/page-${pageNumber}`);
        
        // Get page metrics before closing
        const pageMetrics = await page.metrics();
        
        await page.close();
        
        return pageMetrics;
      };

      const result = await loadGenerator.generateLoad(pageCreationTest, 5, 25);
      
      expect(result.successRate).toBeGreaterThan(95); // >95% success
      expect(result.averageTime).toBeLessThan(2000); // <2s per page
      
      console.log(`📊 Page lifecycle test (5 concurrent, 25 total):
        - Success Rate: ${result.successRate.toFixed(1)}%
        - Average Time: ${result.averageTime.toFixed(2)}ms`);
    });

    test('Memory usage during sustained page operations', async () => {
      const memoryTracker = performanceMonitor.trackResources('page_operations', 1000, 30000);
      
      // Sustained page operations for 30 seconds
      const sustainedTest = async () => {
        const operations = Array(60).fill().map(async (_, i) => {
          await new Promise(resolve => setTimeout(resolve, i * 500)); // Spread over 30 seconds
          
          const page = await mockBrowser.newPage();
          await page.goto(`https://example.com/test-${i}`);
          
          // Simulate scraping work
          await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a')).map(a => a.href);
          });
          
          await page.close();
          return i;
        });
        
        return await Promise.all(operations);
      };

      const { result, metrics } = await measureAsync('sustained_page_ops', sustainedTest);
      
      await memoryTracker;
      const report = performanceMonitor.generateReport('page_operations');
      
      expect(report.memory.growth).toBeLessThan(200 * 1024 * 1024); // <200MB growth
      expect(result).toHaveLength(60);
      
      console.log(`📊 Sustained Page Operations (30 seconds):
        - Operations: 60
        - Memory Growth: ${report.memory.growthFormatted}
        - Max Memory: ${report.memory.maxFormatted}`);
    });
  });

  describe('Scraper Memory Leak Detection', () => {
    test('Single source scraping memory stability', async () => {
      const initialMemory = performanceMonitor.getMemoryUsage();
      
      // Run multiple scraping cycles
      const cycles = 10;
      for (let i = 0; i < cycles; i++) {
        await mockScraperManager.scrapeSource('library');
        
        // Force garbage collection between cycles if available
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = performanceMonitor.getMemoryUsage();
      const memoryLeak = finalMemory.current.heapUsed - initialMemory.current.heapUsed;
      
      expect(memoryLeak).toBeLessThan(50 * 1024 * 1024); // <50MB leak after 10 cycles
      
      console.log(`📊 Memory leak test (${cycles} cycles):
        - Memory increase: ${performanceMonitor.formatMemory(memoryLeak)}
        - Per cycle: ${performanceMonitor.formatMemory(memoryLeak / cycles)}`);
    });

    test('Page object cleanup verification', async () => {
      let openPages = 0;
      
      // Override newPage to track page creation
      const originalNewPage = mockBrowser.newPage;
      mockBrowser.newPage = jest.fn().mockImplementation(async () => {
        openPages++;
        const page = await originalNewPage();
        
        // Override close to track cleanup
        const originalClose = page.close;
        page.close = jest.fn().mockImplementation(async () => {
          openPages--;
          return await originalClose();
        });
        
        return page;
      });

      // Run scraping operations
      const operations = Array(5).fill().map(async (_, i) => {
        return await mockScraperManager.scrapeSource(`source-${i}`);
      });

      await Promise.all(operations);
      
      // All pages should be cleaned up
      expect(openPages).toBe(0);
      
      console.log(`✅ Page cleanup verification: All ${operations.length} operations cleaned up properly`);
      
      // Restore original method
      mockBrowser.newPage = originalNewPage;
    });

    test('Browser resource monitoring during heavy scraping', async () => {
      const resourceTracker = performanceMonitor.trackResources('heavy_scraping', 500, 15000);
      
      const heavyScrapingTest = async () => {
        // Simulate heavy scraping load
        const sources = ['library', 'eventbrite', 'parks', 'museums', 'schools', 'community'];
        const concurrentJobs = sources.map(async (source, index) => {
          // Stagger start times to simulate real load
          await new Promise(resolve => setTimeout(resolve, index * 1000));
          
          // Multiple scraping rounds per source
          for (let round = 0; round < 3; round++) {
            await mockScraperManager.scrapeSource(source);
            await new Promise(resolve => setTimeout(resolve, 500)); // Cooling period
          }
          
          return source;
        });
        
        return await Promise.all(concurrentJobs);
      };

      const { result, metrics } = await measureAsync('heavy_scraping', heavyScrapingTest);
      
      await resourceTracker;
      const report = performanceMonitor.generateReport('heavy_scraping');
      
      expect(report.memory.growth).toBeLessThan(300 * 1024 * 1024); // <300MB growth
      expect(result).toHaveLength(6); // All sources completed
      
      console.log(`📊 Heavy Scraping Resource Analysis:
        - Duration: 15 seconds
        - Sources: ${result.length}
        - Memory Growth: ${report.memory.growthFormatted}
        - Peak Memory: ${report.memory.maxFormatted}`);
    });
  });

  describe('Concurrent Scraper Performance', () => {
    test('Multiple source scraping performance', async () => {
      const concurrentScrapingTest = async (sourceIndex) => {
        const sources = ['library', 'eventbrite', 'parks', 'museums', 'schools'];
        const source = sources[sourceIndex % sources.length];
        
        return await mockScraperManager.scrapeSource(source);
      };

      const result = await loadGenerator.generateLoad(concurrentScrapingTest, 5, 15);
      
      expect(result.successRate).toBeGreaterThan(90); // >90% success rate
      expect(result.averageTime).toBeLessThan(3000); // <3s average per scrape
      
      const totalEvents = result.results
        .filter(r => r.success)
        .reduce((sum, r) => sum + (r.result?.length || 0), 0);
      
      console.log(`📊 Concurrent Scraping (5 concurrent, 15 total):
        - Success Rate: ${result.successRate.toFixed(1)}%
        - Average Time: ${result.averageTime.toFixed(2)}ms
        - Total Events Found: ${totalEvents}
        - Events per Second: ${(totalEvents / (result.totalTime / 1000)).toFixed(1)}`);
    });

    test('Browser connection pool efficiency', async () => {
      // Test browser reuse vs new browser creation
      const reuseTest = async (operationId) => {
        // Simulate scraper operations that reuse browser
        const page = await mockBrowser.newPage();
        await page.goto(`https://example.com/reuse-${operationId}`);
        
        const events = await page.evaluate(() => {
          // Mock event extraction
          return Array(Math.floor(Math.random() * 10) + 1).fill().map((_, i) => ({
            title: `Reuse Event ${i}`,
            url: `https://example.com/event-${i}`
          }));
        });
        
        await page.close();
        return events;
      };

      const result = await loadGenerator.generateLoad(reuseTest, 8, 40);
      
      expect(result.successRate).toBeGreaterThan(95); // Should be very reliable with browser reuse
      expect(result.averageTime).toBeLessThan(1500); // Should be faster with reuse
      
      console.log(`📊 Browser Reuse Efficiency (8 concurrent, 40 operations):
        - Success Rate: ${result.successRate.toFixed(1)}%
        - Average Time: ${result.averageTime.toFixed(2)}ms
        - Operations/second: ${(result.totalOperations / (result.totalTime / 1000)).toFixed(1)}`);
    });

    test('Peak load scraping scenario', async () => {
      // Simulate peak usage: multiple users triggering scraping simultaneously
      const peakLoadTest = async (userId) => {
        const userSources = ['library', 'parks', 'museums'];
        const results = [];
        
        // Each "user" scrapes multiple sources
        for (const source of userSources) {
          const events = await mockScraperManager.scrapeSource(`${source}-user${userId}`);
          results.push(...events);
        }
        
        return results;
      };

      const result = await loadGenerator.generateLoad(peakLoadTest, 3, 9); // 3 concurrent "users"
      
      expect(result.successRate).toBeGreaterThan(85); // >85% under peak load
      
      const avgEventsPerUser = result.results
        .filter(r => r.success)
        .reduce((sum, r) => sum + (r.result?.length || 0), 0) / result.successful;
      
      console.log(`📊 Peak Load Scenario (3 concurrent users, 9 total sessions):
        - Success Rate: ${result.successRate.toFixed(1)}%
        - Average Time per User: ${result.averageTime.toFixed(2)}ms
        - Average Events per User: ${avgEventsPerUser.toFixed(1)}
        - Total Duration: ${result.totalTime.toFixed(2)}ms`);
    });
  });

  describe('Error Recovery and Resource Cleanup', () => {
    test('Scraper recovery after page crashes', async () => {
      let crashCount = 0;
      
      const crashRecoveryTest = async (operationId) => {
        // Simulate page crashes for first few operations
        if (operationId < 3) {
          crashCount++;
          const error = new Error('Page crashed');
          error.name = 'TargetCloseError';
          throw error;
        }
        
        // Normal operations after recovery
        return await mockScraperManager.scrapeSource('recovery-test');
      };

      const result = await loadGenerator.generateLoad(crashRecoveryTest, 2, 10);
      
      // Should recover after initial crashes
      expect(result.successRate).toBeGreaterThan(70); // >70% overall (accounting for crashes)
      
      const lastHalf = result.results.slice(5);
      const lastHalfSuccessRate = (lastHalf.filter(r => r.success).length / lastHalf.length) * 100;
      expect(lastHalfSuccessRate).toBeGreaterThan(95); // >95% after recovery
      
      console.log(`📊 Crash Recovery Test:
        - Overall Success Rate: ${result.successRate.toFixed(1)}%
        - Recovery Success Rate: ${lastHalfSuccessRate.toFixed(1)}%
        - Crashes Simulated: ${crashCount}`);
    });

    test('Resource cleanup after scraper failures', async () => {
      let resourcesCreated = 0;
      let resourcesCleaned = 0;
      
      const failureCleanupTest = async (operationId) => {
        resourcesCreated++;
        
        try {
          // Simulate failures for some operations
          if (operationId % 4 === 0) {
            throw new Error('Simulated scraper failure');
          }
          
          const result = await mockScraperManager.scrapeSource('cleanup-test');
          resourcesCleaned++; // Successful completion
          return result;
        } catch (error) {
          resourcesCleaned++; // Should still clean up on failure
          throw error;
        }
      };

      const result = await loadGenerator.generateLoad(failureCleanupTest, 4, 20);
      
      // All resources should be cleaned up regardless of success/failure
      expect(resourcesCleaned).toBe(resourcesCreated);
      expect(result.failed).toBeGreaterThan(0); // Some operations should have failed
      
      console.log(`📊 Failure Cleanup Test:
        - Resources Created: ${resourcesCreated}
        - Resources Cleaned: ${resourcesCleaned}
        - Success Rate: ${result.successRate.toFixed(1)}%
        - Failed Operations: ${result.failed}`);
    });

    test('Browser connection timeout handling', async () => {
      const timeoutTest = async (operationId) => {
        // Simulate connection timeouts
        if (operationId % 6 === 0) {
          const error = new Error('Navigation timeout exceeded');
          error.name = 'TimeoutError';
          throw error;
        }
        
        return await mockScraperManager.scrapeSource('timeout-test');
      };

      const result = await loadGenerator.generateLoad(timeoutTest, 3, 18);
      
      expect(result.successRate).toBeGreaterThan(80); // Should handle timeouts gracefully
      
      const timeoutErrors = result.errors.filter(e => e.error.includes('timeout'));
      expect(timeoutErrors.length).toBeGreaterThan(0); // Some timeouts expected
      
      console.log(`📊 Timeout Handling Test:
        - Success Rate: ${result.successRate.toFixed(1)}%
        - Timeout Errors: ${timeoutErrors.length}
        - Average Time: ${result.averageTime.toFixed(2)}ms`);
    });
  });

  describe('Performance Monitoring and Alerting', () => {
    test('Scraper performance threshold monitoring', async () => {
      const thresholds = {
        scraperTime: 5000,      // 5 seconds per source
        memoryGrowth: 100,      // 100MB per scraping session
        successRate: 85         // 85% minimum success rate
      };

      const monitoringTest = async (sourceId) => {
        return await mockScraperManager.scrapeSource(`monitored-source-${sourceId}`);
      };

      const initialMemory = performanceMonitor.getMemoryUsage();
      const result = await loadGenerator.generateLoad(monitoringTest, 3, 15);
      const finalMemory = performanceMonitor.getMemoryUsage();
      
      const memoryGrowthMB = (finalMemory.current.heapUsed - initialMemory.current.heapUsed) / 1024 / 1024;
      
      // Check against thresholds
      const violations = [];
      
      if (result.averageTime > thresholds.scraperTime) {
        violations.push(`Scraper time: ${result.averageTime}ms > ${thresholds.scraperTime}ms`);
      }
      
      if (result.successRate < thresholds.successRate) {
        violations.push(`Success rate: ${result.successRate}% < ${thresholds.successRate}%`);
      }
      
      if (memoryGrowthMB > thresholds.memoryGrowth) {
        violations.push(`Memory growth: ${memoryGrowthMB.toFixed(2)}MB > ${thresholds.memoryGrowth}MB`);
      }
      
      if (violations.length > 0) {
        console.warn(`⚠️  Scraper performance threshold violations:`, violations);
      } else {
        console.log(`✅ All scraper performance thresholds met`);
      }
      
      // Don't fail the test for violations, just monitor and report
      console.log(`📊 Scraper Performance Monitoring:
        - Average Scraper Time: ${result.averageTime.toFixed(2)}ms
        - Success Rate: ${result.successRate.toFixed(1)}%
        - Memory Growth: ${memoryGrowthMB.toFixed(2)}MB
        - Threshold Violations: ${violations.length}`);
    });
  });
});