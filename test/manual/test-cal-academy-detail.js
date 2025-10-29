/**
 * Cal Academy Scraper Detail Test Script
 *
 * Tests the enhanced California Academy of Sciences events scraper with detail page fetching.
 *
 * Usage: node test/manual/test-cal-academy-detail.js [days]
 * Example: node test/manual/test-cal-academy-detail.js 3
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
const winston = require("winston");
const fs = require("fs").promises;
const CalAcademyScraper = require("../../src/scrapers/cal-academy");

// Create logger with color support
const logger = winston.createLogger({
  level: "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [new winston.transports.Console()],
});

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

async function testCalAcademyScraper() {
  const daysToScrape = parseInt(process.argv[2]) || 3;

  console.log(
    colorize(
      "\n🔬 Testing Cal Academy Scraper with Detail Page Fetching",
      "bright"
    )
  );
  console.log(colorize(`📅 Scraping ${daysToScrape} days of events\n`, "cyan"));

  try {
    const scraper = new CalAcademyScraper(logger);

    console.log(colorize(`🔍 Scraping: ${scraper.url}`, "blue"));
    console.log(
      colorize(
        "⏳ This may take several minutes due to detail page fetching...\n",
        "yellow"
      )
    );

    const startTime = Date.now();
    const events = await scraper.scrape(daysToScrape);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(colorize(`\n✅ Scraping completed in ${duration}s`, "green"));
    console.log(colorize(`\n${"=".repeat(80)}`, "cyan"));
    console.log(colorize("📊 RESULTS SUMMARY", "bright"));
    console.log(colorize("=".repeat(80), "cyan"));

    console.log(
      `\n${colorize("Total events found:", "bright")} ${events.length}`
    );

    if (events.length === 0) {
      console.log(
        colorize(
          "\n⚠️  No events found. This might indicate an issue with the scraper.",
          "yellow"
        )
      );
      await scraper.closeBrowser();
      return;
    }

    // Data quality metrics
    const eventsWithDetails = events.filter((e) => e.detailsFetched);
    const eventsWithoutDetails = events.filter((e) => !e.detailsFetched);
    const eventsWithDescriptions = events.filter(
      (e) => e.description && e.description.length > 50
    );
    const eventsWithDefaultTime = events.filter((e) => {
      const hour = new Date(e.date).getHours();
      return hour === 10 && new Date(e.date).getMinutes() === 0;
    });

    console.log(`\n${colorize("Data Quality:", "bright")}`);
    console.log(
      `  ${colorize("✓", "green")} Events with detail page data: ${
        eventsWithDetails.length
      } (${((eventsWithDetails.length / events.length) * 100).toFixed(1)}%)`
    );
    console.log(
      `  ${colorize("✗", "red")} Events without detail page: ${
        eventsWithoutDetails.length
      } (${((eventsWithoutDetails.length / events.length) * 100).toFixed(1)}%)`
    );
    console.log(
      `  ${colorize("✓", "green")} Events with substantial descriptions: ${
        eventsWithDescriptions.length
      } (${((eventsWithDescriptions.length / events.length) * 100).toFixed(
        1
      )}%)`
    );
    console.log(
      `  ${colorize("⚠", "yellow")} Events with default time (10:00 AM): ${
        eventsWithDefaultTime.length
      } (${((eventsWithDefaultTime.length / events.length) * 100).toFixed(1)}%)`
    );

    // Age range distribution
    console.log(`\n${colorize("📈 Age Range Distribution:", "bright")}`);
    const ageRanges = {};
    events.forEach((event) => {
      const range = `${event.ageRange.min}-${event.ageRange.max}`;
      ageRanges[range] = (ageRanges[range] || 0) + 1;
    });

    Object.entries(ageRanges)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([range, count]) => {
        const bar = "█".repeat(Math.ceil((count / events.length) * 50));
        console.log(`  ${range} years: ${bar} ${count}`);
      });

    // Cost distribution
    console.log(`\n${colorize("💰 Cost Distribution:", "bright")}`);
    const costs = {};
    events.forEach((event) => {
      const cost = `$${event.cost}`;
      costs[cost] = (costs[cost] || 0) + 1;
    });

    Object.entries(costs)
      .sort(
        ([a], [b]) => parseFloat(a.substring(1)) - parseFloat(b.substring(1))
      )
      .forEach(([cost, count]) => {
        const bar = "█".repeat(Math.ceil((count / events.length) * 50));
        const color =
          cost === "$0" ? "green" : cost === "$25" ? "yellow" : "cyan";
        console.log(`  ${colorize(cost.padEnd(10), color)}: ${bar} ${count}`);
      });

    // Time distribution
    console.log(`\n${colorize("⏰ Time Distribution:", "bright")}`);
    const times = {};
    events.forEach((event) => {
      const date = new Date(event.date);
      const hour = date.getHours();
      const minute = date.getMinutes();
      const timeStr = `${hour.toString().padStart(2, "0")}:${minute
        .toString()
        .padStart(2, "0")}`;
      times[timeStr] = (times[timeStr] || 0) + 1;
    });

    Object.entries(times)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 15)
      .forEach(([time, count]) => {
        const bar = "█".repeat(Math.ceil((count / events.length) * 50));
        const color = time === "10:00" ? "yellow" : "cyan";
        console.log(`  ${colorize(time, color)}: ${bar} ${count}`);
      });

    // Filter for target age range (3-5 years old children)
    const targetEvents = events.filter(
      (event) => event.ageRange.min <= 5 && event.ageRange.max >= 3
    );

    console.log(
      `\n${colorize("🎯 Events suitable for ages 3-5:", "bright")} ${
        targetEvents.length
      } (${((targetEvents.length / events.length) * 100).toFixed(1)}%)`
    );

    // Show sample events with details
    console.log(colorize(`\n${"=".repeat(80)}`, "cyan"));
    console.log(colorize("📋 SAMPLE EVENTS (First 5)", "bright"));
    console.log(colorize("=".repeat(80), "cyan"));

    events.slice(0, 5).forEach((event, index) => {
      console.log(`\n${colorize(`${index + 1}. ${event.title}`, "bright")}`);
      console.log(`   📅 Date: ${new Date(event.date).toLocaleString()}`);
      console.log(`   📍 Location: ${event.location.address}`);
      console.log(
        `   👶 Age Range: ${event.ageRange.min}-${event.ageRange.max} years ${
          event.detailsFetched && event.ageRange.min !== 3
            ? colorize("(from detail page)", "green")
            : colorize("(estimated)", "yellow")
        }`
      );
      console.log(
        `   💰 Cost: $${event.cost} ${
          event.detailsFetched && event.cost !== 25
            ? colorize("(from detail page)", "green")
            : colorize("(estimated)", "yellow")
        }`
      );
      console.log(`   🔗 URL: ${event.registrationUrl}`);
      console.log(`   🔄 Recurring: ${event.isRecurring ? "Yes" : "No"}`);
      console.log(
        `   📄 Detail Page: ${
          event.detailsFetched
            ? colorize("✓ Fetched", "green")
            : colorize("✗ Not fetched", "red")
        }`
      );

      if (event.description) {
        const maxLen = 150;
        const desc =
          event.description.length > maxLen
            ? event.description.substring(0, maxLen) + "..."
            : event.description;
        console.log(`   📝 Description: ${desc}`);
      }
    });

    // Show sample events suitable for target age
    if (targetEvents.length > 0) {
      console.log(colorize(`\n${"=".repeat(80)}`, "cyan"));
      console.log(
        colorize("👶 TARGET AGE EVENTS (Ages 3-5, First 5)", "bright")
      );
      console.log(colorize("=".repeat(80), "cyan"));

      targetEvents.slice(0, 5).forEach((event, index) => {
        console.log(`\n${colorize(`${index + 1}. ${event.title}`, "bright")}`);
        console.log(`   📅 ${new Date(event.date).toLocaleString()}`);
        console.log(
          `   👶 Ages ${event.ageRange.min}-${event.ageRange.max} | 💰 $${event.cost}`
        );
        console.log(
          `   📄 ${
            event.detailsFetched
              ? colorize("Detail page fetched", "green")
              : colorize("No detail page", "yellow")
          }`
        );
        if (event.description && event.description.length > 20) {
          const desc = event.description.substring(0, 100);
          console.log(
            `   📝 ${desc}${event.description.length > 100 ? "..." : ""}`
          );
        }
      });
    }

    // Show events with issues
    console.log(colorize(`\n${"=".repeat(80)}`, "cyan"));
    console.log(colorize("⚠️  DATA QUALITY ISSUES", "bright"));
    console.log(colorize("=".repeat(80), "cyan"));

    const eventsWithNoDescription = events.filter(
      (e) => !e.description || e.description.length < 20
    );
    if (eventsWithNoDescription.length > 0) {
      console.log(
        `\n${colorize(
          `Events with no/minimal description: ${eventsWithNoDescription.length}`,
          "yellow"
        )}`
      );
      eventsWithNoDescription.slice(0, 3).forEach((e) => {
        console.log(`  - ${e.title}`);
      });
    }

    if (eventsWithDefaultTime.length > 0) {
      console.log(
        `\n${colorize(
          `Events using default 10:00 AM time: ${eventsWithDefaultTime.length}`,
          "yellow"
        )}`
      );
      eventsWithDefaultTime.slice(0, 3).forEach((e) => {
        console.log(
          `  - ${e.title} ${
            e.detailsFetched
              ? colorize("(detail page fetched but no time found)", "red")
              : colorize("(no detail page)", "yellow")
          }`
        );
      });
    }

    const eventsWithDefaultCost = events.filter((e) => e.cost === 25);
    if (eventsWithDefaultCost.length > events.length * 0.8) {
      console.log(
        `\n${colorize(
          `Most events (${eventsWithDefaultCost.length}) have default $25 cost - might indicate pricing extraction issues`,
          "yellow"
        )}`
      );
    }

    // Save results to JSON file
    const timestamp = Date.now();
    const outputFile = path.join(
      __dirname,
      `../cal-academy-test-results-${timestamp}.json`
    );

    const results = {
      timestamp: new Date().toISOString(),
      daysScraped: daysToScrape,
      durationSeconds: parseFloat(duration),
      totalEvents: events.length,
      metrics: {
        eventsWithDetails: eventsWithDetails.length,
        eventsWithoutDetails: eventsWithoutDetails.length,
        eventsWithDescriptions: eventsWithDescriptions.length,
        eventsWithDefaultTime: eventsWithDefaultTime.length,
        targetAgeEvents: targetEvents.length,
      },
      ageRanges,
      costs,
      times,
      events: events.map((e) => ({
        title: e.title,
        date: e.date,
        ageRange: e.ageRange,
        cost: e.cost,
        description: e.description?.substring(0, 200),
        detailsFetched: e.detailsFetched,
        registrationUrl: e.registrationUrl,
      })),
    };

    await fs.writeFile(outputFile, JSON.stringify(results, null, 2));
    console.log(colorize(`\n💾 Results saved to: ${outputFile}`, "green"));

    await scraper.closeBrowser();
    console.log(
      colorize(
        "\n✅ Cal Academy scraper test completed successfully\n",
        "green"
      )
    );
  } catch (error) {
    console.error(
      colorize("❌ Cal Academy scraper test failed:", "red"),
      error.message
    );
    logger.error("Cal Academy scraper test error:", error);
    process.exit(1);
  }
}

testCalAcademyScraper();

