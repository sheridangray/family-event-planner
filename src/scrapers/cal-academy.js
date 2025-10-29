const BaseScraper = require("./base");
const cheerio = require("cheerio");

class CalAcademyScraper extends BaseScraper {
  constructor(logger) {
    super("cal-academy", "https://www.calacademy.org/daily-calendar", logger);
    this.detailsCache = new Map(); // Cache detail page data by event title
  }

  async scrape(daysToScrape = 3) {
    try {
      this.logger.info(
        `Scraping ${this.name} from ${this.url} for ${daysToScrape} days...`
      );

      const allEvents = [];
      const seenEventKeys = new Set(); // Track unique events across dates

      // Iterate through dates
      for (let dayOffset = 0; dayOffset < daysToScrape; dayOffset++) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + dayOffset);
        const dateStr = targetDate.toISOString().split("T")[0];
        const calendarUrl =
          dayOffset === 0 ? this.url : `${this.url}?date=${dateStr}`;

        this.logger.info(
          `Scraping date ${dayOffset + 1}/${daysToScrape}: ${dateStr}`
        );

        try {
          // Fetch the daily calendar page
          const html = await this.fetchWithPuppeteer(calendarUrl);
          this.logger.debug(
            `Fetched HTML length: ${html.length} characters for ${dateStr}`
          );

          const $ = cheerio.load(html);

          // Find all event containers
          const eventContainers = $(
            ".event-container, .event-item, .daily-event, .program-listing"
          ).filter((index, element) => {
            // Filter for containers that have event-like content
            const $el = $(element);
            return (
              $el.find("time, .time").length > 0 ||
              $el.find("h3, .title").length > 0
            );
          });

          this.logger.info(
            `Found ${eventContainers.length} potential events on Cal Academy calendar for ${dateStr}`
          );

          // Look for actual program/event links, but be more selective
          let eventLinks = $(
            'a[href*="/events/programs/"], a[href*="/events/planetarium-show/"]'
          );

          // Also look for links that mention specific programs/shows in their text
          const programLinks = $("a").filter((index, element) => {
            const text = $(element).text().toLowerCase();
            const href = $(element).attr("href") || "";
            return (
              (href.includes("/events/") || href.includes("/programs/")) &&
              (text.includes("storytime") ||
                text.includes("feeding") ||
                text.includes("show") ||
                text.includes("theater") ||
                text.includes("adventure") ||
                text.includes("dive") ||
                text.includes("talk") ||
                text.length > 10)
            ); // Avoid short generic links
          });

          eventLinks = eventLinks.add(programLinks);

          this.logger.info(
            `Found ${eventLinks.length} potential program/event links for ${dateStr}`
          );

          // Process event containers if found
          if (eventContainers.length > 0) {
            for (let i = 0; i < eventContainers.length; i++) {
              const event = await this.processEventContainer(
                $,
                $(eventContainers[i]),
                targetDate
              );
              if (event) {
                const eventKey = `${event.title}-${event.date.toISOString()}`;
                if (!seenEventKeys.has(eventKey)) {
                  allEvents.push(event);
                  seenEventKeys.add(eventKey);
                }
              }
              // Add delay between detail page fetches to avoid rate limiting
              if (i < eventContainers.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 5000));
              }
            }
          }

          // Process event links
          if (eventLinks.length > 0) {
            for (let i = 0; i < eventLinks.length; i++) {
              const event = await this.processEventLink(
                $,
                $(eventLinks[i]),
                targetDate
              );
              if (event) {
                const eventKey = `${event.title}-${event.date.toISOString()}`;
                if (!seenEventKeys.has(eventKey)) {
                  allEvents.push(event);
                  seenEventKeys.add(eventKey);
                }
              }
              // Add delay between detail page fetches to avoid rate limiting
              if (i < eventLinks.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 5000));
              }
            }
          }

          // Small delay between date requests to be respectful
          if (dayOffset < daysToScrape - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } catch (dateError) {
          this.logger.error(
            `Error scraping date ${dateStr}: ${dateError.message}`
          );
          this.logger.error(`Error stack:`, dateError.stack);
          this.logger.error(`Calendar URL that failed: ${calendarUrl}`);
          // Continue to next date
        }
      }

      this.logger.info(
        `Successfully processed ${allEvents.length} unique events from Cal Academy across ${daysToScrape} days`
      );
      return allEvents;
    } catch (error) {
      this.logger.error(`Error scraping Cal Academy events:`, error.message);
      return [];
    }
  }

  async fetchEventDetails(eventUrl, eventTitle, retries = 3) {
    if (!eventUrl) return null;

    // Check cache first - many events repeat at different times
    if (this.detailsCache.has(eventTitle)) {
      this.logger.debug(`Using cached details for: ${eventTitle}`);
      return this.detailsCache.get(eventTitle);
    }

    const fullUrl = eventUrl.startsWith("http")
      ? eventUrl
      : `https://www.calacademy.org${eventUrl}`;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        this.logger.debug(
          `Fetching event details from ${fullUrl} (attempt ${attempt}/${retries})`
        );

        const html = await this.fetchWithPuppeteer(fullUrl);
        const $ = cheerio.load(html);

        const details = {
          time: null,
          price: null,
          description: null,
          ageRange: null,
          fullContent: null,
        };

        // Extract full description from various possible locations
        const descriptionSelectors = [
          ".event-description",
          ".program-description",
          ".content-description",
          "article p",
          ".main-content p",
          '[itemprop="description"]',
        ];

        for (const selector of descriptionSelectors) {
          const desc = $(selector).first().text().trim();
          if (desc && desc.length > 50) {
            details.description = desc;
            break;
          }
        }

        // If no good description found, collect all paragraph text
        if (!details.description) {
          const paragraphs = [];
          $("p").each((i, elem) => {
            const text = $(elem).text().trim();
            if (text.length > 20) {
              paragraphs.push(text);
            }
          });
          if (paragraphs.length > 0) {
            details.description = paragraphs.slice(0, 3).join(" ");
          }
        }

        // Extract time from detail page
        const timeSelectors = [
          ".event-time",
          ".program-time",
          "time",
          "[datetime]",
          ".time",
        ];

        for (const selector of timeSelectors) {
          const timeElem = $(selector).first();
          const timeText = timeElem.text().trim() || timeElem.attr("datetime");
          if (timeText) {
            const timeMatch = timeText.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
            if (timeMatch) {
              details.time = timeMatch[0];
              break;
            }
          }
        }

        // Look for time patterns anywhere in the text
        if (!details.time) {
          const bodyText = $("body").text();
          const timePattern =
            /(\d{1,2}):(\d{2})\s*(am|pm)(?:\s*-\s*(\d{1,2}):(\d{2})\s*(am|pm))?/gi;
          const matches = bodyText.match(timePattern);
          if (matches && matches.length > 0) {
            details.time = matches[0];
          }
        }

        // Extract price information
        const priceSelectors = [
          ".price",
          ".cost",
          ".ticket-price",
          '[class*="price"]',
          '[class*="cost"]',
          'button:contains("Buy")',
          'a:contains("Buy")',
          ".btn-buy",
        ];

        for (const selector of priceSelectors) {
          const priceElem = $(selector).first();
          const priceText =
            priceElem.text() + " " + priceElem.attr("data-price");
          const priceMatch = priceText.match(/\$(\d+(?:\.\d{2})?)/);
          if (priceMatch) {
            details.price = parseFloat(priceMatch[1]);
            break;
          }
        }

        // Look for "free" or "included with admission"
        const bodyText = $("body").text().toLowerCase();
        if (
          bodyText.includes("free admission") ||
          bodyText.includes("included with admission") ||
          bodyText.includes("included with general admission")
        ) {
          details.price = 0;
        } else if (bodyText.includes("general admission") && !details.price) {
          details.price = 25; // Cal Academy general admission
        }

        // Extract age range information
        const agePattern =
          /(?:ages?|for)\s*(\d+)[\s-]*(?:to|through|\-|–)[\s-]*(\d+)/i;
        const pageText = $("body").text();
        const ageMatch = pageText.match(agePattern);
        if (ageMatch) {
          details.ageRange = {
            min: parseInt(ageMatch[1]),
            max: parseInt(ageMatch[2]),
          };
        }

        // Store full content for LLM processing
        details.fullContent = $("body").text().substring(0, 2000);

        this.logger.debug(
          `Extracted details: time=${details.time}, price=${
            details.price
          }, descLength=${details.description?.length || 0}`
        );

        // Cache the details for future use
        this.detailsCache.set(eventTitle, details);
        this.logger.debug(
          `Cached details for: ${eventTitle} (cache size: ${this.detailsCache.size})`
        );

        return details;
      } catch (error) {
        if (attempt === retries) {
          this.logger.warn(
            `Failed to fetch details after ${retries} attempts from ${fullUrl}: ${error.message}`
          );
          return null;
        }
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        this.logger.debug(
          `Retry ${attempt}/${retries} failed, waiting ${delay}ms before next attempt`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    return null;
  }

  extractTimeFromCalendarElement($element, $, baseDate) {
    try {
      // Look for time text in various positions relative to the element
      // Cal Academy calendar has times like "10:30 am" before event links
      let timeText = null;

      // Try to find time in parent's text content
      const parentText = $element.parent().text();
      const timeMatch = parentText.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
      if (timeMatch) {
        timeText = timeMatch[0];
      }

      // Try previous sibling
      if (!timeText) {
        const prevText = $element.prev().text();
        const prevMatch = prevText.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
        if (prevMatch) {
          timeText = prevMatch[0];
        }
      }

      // Try finding time element before this element
      if (!timeText) {
        const timeElem = $element
          .closest('.event-item, .event-row, [class*="event"]')
          .find('.time, [class*="time"]')
          .first();
        if (timeElem.length > 0) {
          const elemText = timeElem.text();
          const elemMatch = elemText.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
          if (elemMatch) {
            timeText = elemMatch[0];
          }
        }
      }

      if (timeText) {
        return this.parseCalAcademyTime(timeText, baseDate);
      }
    } catch (error) {
      this.logger.debug(
        `Error extracting time from calendar element: ${error.message}`
      );
    }
    return null;
  }

  async processEventContainer($, $container, today) {
    try {
      // Extract time
      const timeElement = $container.find("time, .time");
      const timeText = timeElement.text().trim();

      // Extract title from link or heading
      const titleElement = $container.find("h3, .title, a h3");
      const title = titleElement.text().trim();

      // Extract link to full event page
      const linkElement = $container.find("a").first();
      const eventUrl = linkElement.attr("href");

      // Extract location
      const locationElement = $container.find(".location, .venue");
      const location = locationElement.text().trim();

      // Extract description
      const descElement = $container.find("p, .description");
      const description = descElement.text().trim();

      if (!title) {
        this.logger.debug("Skipping event container - missing title");
        return null;
      }

      // Fetch detailed information from event page
      let detailPageData = null;
      if (eventUrl) {
        detailPageData = await this.fetchEventDetails(eventUrl, title);
      }

      // Use detail page time if available, otherwise parse from container
      let eventDate;
      if (detailPageData?.time) {
        eventDate = this.parseCalAcademyTime(detailPageData.time, today);
      } else if (timeText) {
        eventDate = this.parseCalAcademyTime(timeText, today);
      }

      // Default to 10 AM if no time found
      if (!eventDate) {
        eventDate = new Date(today);
        eventDate.setHours(10, 0, 0, 0);
        this.logger.debug(`Using default time for event: ${title}`);
      }

      // Use detail page description if available and longer
      const finalDescription =
        detailPageData?.description &&
        detailPageData.description.length > description.length
          ? detailPageData.description
          : description;

      // Use detail page age range if available
      const ageRange =
        detailPageData?.ageRange ||
        this.extractCalAcademyAgeRange(title + " " + finalDescription);

      // Use detail page price if available
      const cost =
        detailPageData?.price !== null && detailPageData?.price !== undefined
          ? detailPageData.price
          : this.extractCalAcademyCost(title + " " + finalDescription);

      // Create event data
      const eventData = {
        title: title,
        date: eventDate,
        location: {
          address:
            location || "California Academy of Sciences, San Francisco, CA",
          lat: 37.7699, // Cal Academy coordinates
          lng: -122.4661,
        },
        ageRange: ageRange,
        cost: cost,
        registrationUrl: eventUrl
          ? eventUrl.startsWith("http")
            ? eventUrl
            : `https://www.calacademy.org${eventUrl}`
          : this.url,
        registrationOpens: null,
        currentCapacity: {},
        description: finalDescription,
        imageUrl: null,
        isRecurring: this.isLikelyRecurring(title),
        rawContent: detailPageData?.fullContent || finalDescription,
        detailsFetched: !!detailPageData,
      };

      const event = this.createEvent(eventData);
      this.logger.debug(
        `Processed Cal Academy event: ${title} at ${eventDate}${
          detailPageData ? " (with details)" : " (no details)"
        }`
      );
      return event;
    } catch (error) {
      this.logger.error(
        "Error processing Cal Academy event container:",
        error.message
      );
      return null;
    }
  }

  async processEventLink($, $link, today) {
    try {
      const title = $link.text().trim();
      const eventUrl = $link.attr("href");

      if (!title || title.length < 5) {
        return null;
      }

      // Filter out generic/non-event links
      const lowerTitle = title.toLowerCase();
      const skipPatterns = [
        "museum opens",
        "museum closes",
        "lectures & workshops",
        "hours",
        "admission",
        "tickets",
        "visit",
        "calendar",
        "exhibits",
        "about",
        "contact",
        "directions",
      ];

      if (skipPatterns.some((pattern) => lowerTitle.includes(pattern))) {
        return null;
      }

      // Try to extract time from calendar page first
      let eventDate = this.extractTimeFromCalendarElement($link, $, today);

      // Fetch detailed information from event page
      let detailPageData = null;
      if (eventUrl) {
        detailPageData = await this.fetchEventDetails(eventUrl, title);
      }

      // Use detail page time if available and we didn't get it from calendar
      if (!eventDate && detailPageData?.time) {
        eventDate = this.parseCalAcademyTime(detailPageData.time, today);
      }

      // Default to 10 AM if no time found
      if (!eventDate) {
        eventDate = new Date(today);
        eventDate.setHours(10, 0, 0, 0);
      }

      // Use detail page data if available
      const description = detailPageData?.description || "";
      const ageRange =
        detailPageData?.ageRange ||
        this.extractCalAcademyAgeRange(title + " " + description);
      const cost =
        detailPageData?.price !== null && detailPageData?.price !== undefined
          ? detailPageData.price
          : this.extractCalAcademyCost(title + " " + description);

      const eventData = {
        title: title,
        date: eventDate,
        location: {
          address: "California Academy of Sciences, San Francisco, CA",
          lat: 37.7699,
          lng: -122.4661,
        },
        ageRange: ageRange,
        cost: cost,
        registrationUrl: eventUrl
          ? eventUrl.startsWith("http")
            ? eventUrl
            : `https://www.calacademy.org${eventUrl}`
          : this.url,
        registrationOpens: null,
        currentCapacity: {},
        description: description,
        imageUrl: null,
        isRecurring: this.isLikelyRecurring(title),
        rawContent: detailPageData?.fullContent || description,
        detailsFetched: !!detailPageData,
      };

      const event = this.createEvent(eventData);
      this.logger.debug(
        `Processed Cal Academy event link: ${title}${
          detailPageData ? " (with details)" : " (no details)"
        }`
      );
      return event;
    } catch (error) {
      this.logger.error(
        "Error processing Cal Academy event link:",
        error.message
      );
      return null;
    }
  }

  parseCalAcademyTime(timeText, baseDate) {
    try {
      if (!timeText) return null;

      // Parse time formats like "10:30 am", "2:15 pm"
      const timeMatch = timeText.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
      if (!timeMatch) {
        this.logger.debug(`Could not parse time format: ${timeText}`);
        return null;
      }

      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const ampm = timeMatch[3].toLowerCase();

      // Convert to 24-hour format
      if (ampm === "pm" && hours !== 12) {
        hours += 12;
      } else if (ampm === "am" && hours === 12) {
        hours = 0;
      }

      const date = new Date(baseDate);
      date.setHours(hours, minutes, 0, 0);

      return date;
    } catch (error) {
      this.logger.error(
        `Error parsing Cal Academy time ${timeText}:`,
        error.message
      );
      return null;
    }
  }

  extractCalAcademyAgeRange(text) {
    if (!text) return { min: 0, max: 18 };

    const lowerText = text.toLowerCase();

    // Look for specific age mentions
    const ageMatch = text.match(
      /(\d+)[\s-]*(?:to|through|\-|–)[\s-]*(\d+)[\s-]*(?:years?|yrs?)?/i
    );
    if (ageMatch) {
      return { min: parseInt(ageMatch[1]), max: parseInt(ageMatch[2]) };
    }

    // Specific program types
    if (lowerText.includes("storytime") || lowerText.includes("story time")) {
      return { min: 2, max: 8 }; // Typical storytime age range
    }

    if (lowerText.includes("toddler")) {
      return { min: 1, max: 3 };
    }

    if (lowerText.includes("preschool")) {
      return { min: 3, max: 5 };
    }

    if (lowerText.includes("family")) {
      return { min: 0, max: 12 };
    }

    if (lowerText.includes("adult")) {
      return { min: 18, max: 99 };
    }

    // Science-focused activities are often good for school-age kids
    if (
      lowerText.includes("science") ||
      lowerText.includes("planetarium") ||
      lowerText.includes("exhibit")
    ) {
      return { min: 4, max: 14 };
    }

    // Default to broad family range for Cal Academy
    return { min: 3, max: 12 };
  }

  extractCalAcademyCost(text) {
    if (!text) return 25; // Default Cal Academy admission

    const lowerText = text.toLowerCase();

    // Look for explicit cost mentions
    const costMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
    if (costMatch) {
      return parseFloat(costMatch[1]);
    }

    if (lowerText.includes("free") || lowerText.includes("included")) {
      return 0;
    }

    if (lowerText.includes("additional") || lowerText.includes("extra")) {
      return 35; // Assume higher cost for special events
    }

    // Most Cal Academy events require general admission
    return 25; // Approximate general admission cost
  }

  isLikelyRecurring(title) {
    if (!title) return false;

    const lowerTitle = title.toLowerCase();

    // Common recurring event patterns
    const recurringPatterns = [
      "daily",
      "feeding",
      "storytime",
      "demonstration",
      "planetarium",
      "show",
      "tour",
      "talk",
    ];

    return recurringPatterns.some((pattern) => lowerTitle.includes(pattern));
  }
}

module.exports = CalAcademyScraper;
