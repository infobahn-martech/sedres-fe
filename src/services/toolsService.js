// Third-party, keyless APIs. Plain fetch (not Gateway) so auth headers are never sent off-domain.
const DICTIONARY_URL = 'https://en.wiktionary.org/api/rest_v1/page/definition';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

const getJson = async (url, signal) => {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
};

// Wiktionary returns definitions as HTML; parse (never render) it and keep only the top-level text.
const htmlToText = (html = '') => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('ol, ul').forEach((node) => node.remove());
  return doc.body.textContent.replace(/\s+/g, ' ').trim();
};

const fetchWiktionary = (term, signal) =>
  fetch(`${DICTIONARY_URL}/${encodeURIComponent(term)}`, { signal });

// Returns { word, meanings: [{ partOfSpeech, definitions: [{ definition, example }] }] } or null.
const getWordDefinitions = async (word, signal) => {
  let response = await fetchWiktionary(word, signal);
  // Titles are case-sensitive ("Note" ≠ "note"), so retry lowercase before giving up.
  if (response.status === 404 && word !== word.toLowerCase()) {
    response = await fetchWiktionary(word.toLowerCase(), signal);
  }
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Request failed (${response.status})`);

  const data = await response.json();
  const meanings = (data.en || [])
    .map(({ partOfSpeech, definitions = [] }) => ({
      partOfSpeech,
      definitions: definitions
        .map(({ definition, examples }) => ({
          definition: htmlToText(definition),
          example: examples?.length ? htmlToText(examples[0]) : '',
        }))
        .filter(({ definition }) => definition),
    }))
    .filter(({ definitions }) => definitions.length);

  return meanings.length ? { word, meanings } : null;
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
