"use client";

import { useEffect, useState } from 'react';

interface WeatherData {
  temperature: number | null;
  description: string;
  emoji: string;
  city: string;
  error?: string;
  unavailable?: boolean;
}

interface WeatherDisplayProps {
  mobile?: boolean;
}

export function WeatherDisplay({ mobile = false }: WeatherDisplayProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const response = await fetch('/api/weather');
        const data = await response.json();
        setWeather(data);
      } catch (error) {
        console.error('Failed to fetch weather:', error);
        // Set unavailable weather
        setWeather({
          temperature: null,
          description: 'unavailable',
          emoji: '❓',
          city: 'Unknown',
          unavailable: true
        });
      } finally {
        setLoading(false);
      }
    }

    fetchWeather();
  }, []);

  if (loading) {
    return (
      <div className={mobile ? "text-xs text-gray-500 animate-pulse" : "hidden lg:block text-sm text-gray-600 animate-pulse"}>
        🌤️ --°F
      </div>
    );
  }

  if (!weather) {
    return null;
  }

  // Handle unavailable weather
  if (weather.unavailable || weather.temperature === null) {
    return (
      <div 
        className={mobile ? "text-xs text-gray-500 cursor-help" : "hidden lg:block text-sm text-gray-600 cursor-help"}
        title="Weather data unavailable"
      >
        ❓ Unavailable
      </div>
    );
  }

  return (
    <div 
      className={mobile ? "text-xs text-gray-500 cursor-help" : "hidden lg:block text-sm text-gray-600 cursor-help"}
      title={`${weather.description} in ${weather.city}`}
    >
      {weather.emoji} {weather.temperature}°F
    </div>
  );
}