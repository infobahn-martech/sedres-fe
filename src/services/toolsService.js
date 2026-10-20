// Third-party, keyless APIs. Plain fetch (not Gateway) so auth headers are never sent off-domain.
const DICTIONARY_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

const getJson = async (url, signal) => {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
};

const getWordDefinitions = async (word, signal) => {
  const response = await fetch(`${DICTIONARY_URL}/${encodeURIComponent(word)}`, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
};

const searchCities = async (name, signal) => {
  const params = new URLSearchParams({ name, count: '5', language: 'en', format: 'json' });
  const data = await getJson(`${GEOCODING_URL}?${params}`, signal);
  return data.results || [];
};

const getForecast = ({ latitude, longitude }, signal) => {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    forecast_days: '5',
    timezone: 'auto',
  });
  return getJson(`${FORECAST_URL}?${params}`, signal);
};

export default {
  getWordDefinitions,
  searchCities,
  getForecast,
};
