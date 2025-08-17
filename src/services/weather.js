const axios = require('axios');

class WeatherService {
  constructor(logger) {
    this.logger = logger;
    this.apiKey = process.env.WEATHER_API_KEY;
    this.baseUrl = 'https://api.openweathermap.org/data/2.5';
    this.cache = new Map(); // Simple in-memory cache
    this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
  }

  async getWeatherForecast(eventDate, location = 'San Francisco, CA') {
    try {
      const cacheKey = `${location}-${eventDate.toDateString()}`;
      
      // Check cache first
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheExpiry) {
          this.logger.debug(`Using cached weather for ${location} on ${eventDate.toDateString()}`);
          return cached.data;
        }
      }

      // If no API key, return neutral weather
      if (!this.apiKey) {
        this.logger.warn('No WEATHER_API_KEY provided, using default weather assumptions');
        return this.getDefaultWeather();
      }

      const now = new Date();
      const daysDiff = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      let weatherData;

      if (daysDiff <= 5) {
        // Use 5-day forecast for events within 5 days
        weatherData = await this.get5DayForecast(location, eventDate);
      } else {
        // For events beyond 5 days, use historical/seasonal averages
        weatherData = await this.getSeasonalWeather(eventDate, location);
      }

      // Cache the result
      this.cache.set(cacheKey, {
        data: weatherData,
        timestamp: Date.now()
      });

      return weatherData;

    } catch (error) {
      this.logger.error('Error fetching weather data:', error.message);
      return this.getDefaultWeather();
    }
  }

  async get5DayForecast(location, eventDate) {
    const response = await axios.get(`${this.baseUrl}/forecast`, {
      params: {
        q: location,
        appid: this.apiKey,
        units: 'imperial'
      },
      timeout: 10000
    });

    // Find the forecast closest to the event date
    const targetDate = eventDate.toDateString();
    const forecast = response.data.list.find(item => {
      const forecastDate = new Date(item.dt * 1000).toDateString();
      return forecastDate === targetDate;
    }) || response.data.list[0]; // Fallback to first forecast

    return this.parseWeatherData(forecast);
  }

  async getSeasonalWeather(eventDate, location) {
    // For events beyond 5 days, use seasonal patterns for San Francisco
    const month = eventDate.getMonth();
    
    // San Francisco seasonal weather patterns
    const seasonalData = {
      temperature: this.getSeasonalTemp(month),
      condition: this.getSeasonalCondition(month),
      precipitation: this.getSeasonalPrecipitation(month),
      windSpeed: 10, // SF average
      isOutdoorFriendly: this.isSeasonallyOutdoorFriendly(month)
    };

    this.logger.debug(`Using seasonal weather for ${eventDate.toDateString()}: ${seasonalData.condition}`);
    return seasonalData;
  }

  parseWeatherData(forecastItem) {
    const condition = forecastItem.weather[0].main.toLowerCase();
    const temp = forecastItem.main.temp;
    const precipitation = forecastItem.rain ? (forecastItem.rain['3h'] || 0) : 0;
    const windSpeed = forecastItem.wind.speed;

    return {
      temperature: temp,
      condition: condition,
      precipitation: precipitation,
      windSpeed: windSpeed,
      isOutdoorFriendly: this.isOutdoorFriendly(condition, temp, precipitation, windSpeed)
    };
  }

  isOutdoorFriendly(condition, temp, precipitation = 0, windSpeed = 0) {
    // Temperature comfort range for kids (45-85°F)
    if (temp < 45 || temp > 85) {
      return false;
    }

    // Avoid heavy rain/snow
    if (['rain', 'thunderstorm', 'snow', 'drizzle'].includes(condition) && precipitation > 0.1) {
      return false;
    }

    // Avoid very windy conditions (over 20 mph)
    if (windSpeed > 20) {
      return false;
    }

    return true;
  }

  getSeasonalTemp(month) {
    // San Francisco average temperatures by month
    const temps = [57, 60, 62, 64, 66, 68, 69, 69, 70, 68, 62, 57];
    return temps[month] || 65;
  }

  getSeasonalCondition(month) {
    // San Francisco seasonal patterns
    if (month >= 5 && month <= 9) return 'clear'; // Summer: dry season
    if (month >= 11 || month <= 2) return 'rain'; // Winter: rainy season
    return 'clouds'; // Spring/Fall: mixed
  }

  getSeasonalPrecipitation(month) {
    // SF rainfall patterns (inches per month average)
    const rainfall = [4.5, 3.8, 3.3, 1.5, 0.7, 0.2, 0.1, 0.1, 0.3, 1.1, 2.9, 4.0];
    return (rainfall[month] || 1) / 30; // Convert to daily average
  }

  isSeasonallyOutdoorFriendly(month) {
    // SF outdoor season (May-October generally best)
    return month >= 4 && month <= 9;
  }

  getDefaultWeather() {
    // Default assumptions for San Francisco
    return {
      temperature: 65,
      condition: 'clear',
      precipitation: 0,
      windSpeed: 10,
      isOutdoorFriendly: true
    };
  }

  isEventOutdoor(event) {
    const outdoorKeywords = [
      'park', 'outdoor', 'garden', 'beach', 'playground', 'trail',
      'hiking', 'picnic', 'festival', 'farmers market', 'zoo',
      'walking', 'running', 'cycling', 'sports', 'field'
    ];

    const indoorKeywords = [
      'library', 'museum', 'theater', 'studio', 'classroom', 'center',
      'hall', 'auditorium', 'gallery', 'planetarium'
    ];

    const eventText = (event.title + ' ' + event.description + ' ' + event.location?.address).toLowerCase();

    // Check for explicit indoor keywords first
    if (indoorKeywords.some(keyword => eventText.includes(keyword))) {
      return false;
    }

    // Check for outdoor keywords
    if (outdoorKeywords.some(keyword => eventText.includes(keyword))) {
      return true;
    }

    // Default assumption based on venue
    if (eventText.includes('rec') && eventText.includes('park')) {
      return true; // SF Rec & Parks events are often outdoor
    }

    return false; // Default to indoor if unclear
  }

  getWeatherScore(weather) {
    let score = 100;

    // Temperature scoring
    if (weather.temperature < 50 || weather.temperature > 80) {
      score -= 30;
    } else if (weather.temperature < 55 || weather.temperature > 75) {
      score -= 15;
    }

    // Condition scoring
    if (['thunderstorm', 'snow'].includes(weather.condition)) {
      score -= 50;
    } else if (['rain', 'drizzle'].includes(weather.condition)) {
      score -= 30;
    } else if (weather.condition === 'clouds') {
      score -= 10;
    }

    // Precipitation scoring
    if (weather.precipitation > 0.2) {
      score -= 25;
    } else if (weather.precipitation > 0.1) {
      score -= 10;
    }

    // Wind scoring
    if (weather.windSpeed > 25) {
      score -= 25;
    } else if (weather.windSpeed > 15) {
      score -= 10;
    }

    return Math.max(0, score);
  }
}

module.exports = WeatherService;