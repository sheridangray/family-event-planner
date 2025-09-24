import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const weatherApiKey = process.env.WEATHER_API_KEY;
    const homeZip = process.env.HOME_ZIP;
    const homeCity = process.env.HOME_CITY;
    const homeCountry = process.env.HOME_COUNTRY || 'US';

    if (!weatherApiKey) {
      return NextResponse.json({ error: 'Weather API key not configured' }, { status: 500 });
    }

    // Build weather API URL - prefer zip code for accuracy, fallback to city
    let weatherUrl: string;
    if (homeZip) {
      weatherUrl = `https://api.openweathermap.org/data/2.5/weather?zip=${homeZip},${homeCountry}&appid=${weatherApiKey}&units=imperial`;
    } else if (homeCity) {
      weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(homeCity)}&appid=${weatherApiKey}&units=imperial`;
    } else {
      return NextResponse.json({ error: 'No location configured (need HOME_ZIP or HOME_CITY)' }, { status: 500 });
    }

    // OpenWeatherMap API call
    const response = await fetch(weatherUrl, { 
      next: { revalidate: 600 } // Cache for 10 minutes
    });

    if (!response.ok) {
      throw new Error(`Weather API returned ${response.status}`);
    }

    const weatherData = await response.json();
    
    // Extract relevant data
    const weather = {
      temperature: Math.round(weatherData.main.temp),
      description: weatherData.weather[0].description,
      icon: weatherData.weather[0].icon,
      city: weatherData.name,
      // Map OpenWeather icons to emojis
      emoji: getWeatherEmoji(weatherData.weather[0].icon)
    };

    return NextResponse.json(weather);

  } catch (error) {
    console.error('Weather API error:', error);
    
    // Return unavailable status
    return NextResponse.json({
      temperature: null,
      description: 'unavailable',
      emoji: '❓',
      city: 'Unknown',
      error: 'Weather data unavailable',
      unavailable: true
    });
  }
}

function getWeatherEmoji(iconCode: string): string {
  const iconMap: { [key: string]: string } = {
    '01d': '☀️', // clear sky day
    '01n': '🌙', // clear sky night
    '02d': '⛅', // few clouds day
    '02n': '☁️', // few clouds night
    '03d': '☁️', // scattered clouds
    '03n': '☁️',
    '04d': '☁️', // broken clouds
    '04n': '☁️',
    '09d': '🌧️', // shower rain
    '09n': '🌧️',
    '10d': '🌦️', // rain day
    '10n': '🌧️', // rain night
    '11d': '⛈️', // thunderstorm
    '11n': '⛈️',
    '13d': '❄️', // snow
    '13n': '❄️',
    '50d': '🌫️', // mist
    '50n': '🌫️'
  };

  return iconMap[iconCode] || '🌤️';
}