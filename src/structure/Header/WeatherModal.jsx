import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FiCloud,
  FiCloudDrizzle,
  FiCloudLightning,
  FiCloudRain,
  FiCloudSnow,
  FiDroplet,
  FiMapPin,
  FiSearch,
  FiSun,
  FiThermometer,
  FiWind,
} from 'react-icons/fi';
import ToolModal from './ToolModal';
import toolsService from '../../services/toolsService';

const DEFAULT_LOCATION = { latitude: 21.4858, longitude: 39.1925, label: 'Jeddah, Saudi Arabia' };

// WMO weather interpretation codes used by Open-Meteo.
const getCondition = (code) => {
  if (code === 0) return { label: 'Clear sky', Icon: FiSun };
  if (code === 1) return { label: 'Mainly clear', Icon: FiSun };
  if (code === 2) return { label: 'Partly cloudy', Icon: FiCloud };
  if (code === 3) return { label: 'Overcast', Icon: FiCloud };
  if (code === 45 || code === 48) return { label: 'Fog', Icon: FiCloud };
  if (code >= 51 && code <= 57) return { label: 'Drizzle', Icon: FiCloudDrizzle };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: 'Rain', Icon: FiCloudRain };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: 'Snow', Icon: FiCloudSnow };
  if (code >= 95) return { label: 'Thunderstorm', Icon: FiCloudLightning };
  return { label: 'Unknown', Icon: FiCloud };
};

const formatDay = (isoDate, index) => {
  if (index === 0) return 'Today';
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' });
};

const formatCityLabel = ({ name, admin1, country }) => [name, admin1, country].filter(Boolean).join(', ');

function WeatherModal({ show, onClose }) {
  const [query, setQuery] = useState('');
  const [cities, setCities] = useState([]);
  const [location, setLocation] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [status, setStatus] = useState('loading');
  const abortRef = useRef(null);

  const startRequest = () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  };

  const loadForecast = useCallback(async (nextLocation) => {
    const signal = startRequest();
    setLocation(nextLocation);
    setCities([]);
    setStatus('loading');
    try {
      setForecast(await toolsService.getForecast(nextLocation, signal));
      setStatus('success');
    } catch (error) {
      if (error.name !== 'AbortError') setStatus('error');
    }
  }, []);

  useEffect(() => {
    let active = true;
    const loadIfActive = (nextLocation) => active && loadForecast(nextLocation);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) =>
          loadIfActive({ latitude: coords.latitude, longitude: coords.longitude, label: 'Your location' }),
        () => loadIfActive(DEFAULT_LOCATION),
        { timeout: 8000, maximumAge: 10 * 60 * 1000 }
      );
    } else {
      loadIfActive(DEFAULT_LOCATION);
    }

    return () => {
      active = false;
      abortRef.current?.abort();
    };
  }, [loadForecast]);

  const handleSearch = async (event) => {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;

    const signal = startRequest();
    setStatus('searching');
    try {
      const results = await toolsService.searchCities(term, signal);
      if (results.length === 1) {
        loadForecast({ ...results[0], label: formatCityLabel(results[0]) });
        return;
      }
      setCities(results);
      setStatus(results.length ? 'choosing' : 'not-found');
    } catch (error) {
      if (error.name !== 'AbortError') setStatus('error');
    }
  };

  const current = forecast?.current;
  const currentCondition = current ? getCondition(current.weather_code) : null;
  const units = forecast?.current_units;

  return (
    <ToolModal show={show} onClose={onClose} title="Weather" icon={<FiCloud />} className="weather-modal">
      <form className="tool-search" onSubmit={handleSearch}>
        <FiSearch className="tool-search-icon" />
        <input
          type="text"
          className="tool-search-input"
          placeholder="Search a city"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="tool-search-btn" disabled={!query.trim() || status === 'searching'}>
          Search
        </button>
      </form>

      {status === 'choosing' && (
        <ul className="weather-city-list">
          {cities.map((city) => (
            <li key={city.id}>
              <button
                type="button"
                className="weather-city-item"
                onClick={() => loadForecast({ ...city, label: formatCityLabel(city) })}
              >
                <FiMapPin />
                <span>{formatCityLabel(city)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {(status === 'loading' || status === 'searching') && <p className="tool-state">Loading weather…</p>}
      {status === 'not-found' && <p className="tool-state">No city found for “{query.trim()}”.</p>}
      {status === 'error' && (
        <p className="tool-state tool-state--error">
          Couldn’t load the weather.{' '}
          {location && (
            <button type="button" className="tool-link-btn" onClick={() => loadForecast(location)}>
              Retry
            </button>
          )}
        </p>
      )}

      {status === 'success' && current && (
        <>
          <div className="weather-current">
            <div className="weather-current-main">
              <currentCondition.Icon className="weather-current-icon" />
              <div>
                <div className="weather-temp">
                  {Math.round(current.temperature_2m)}
                  {units.temperature_2m}
                </div>
                <div className="weather-condition">{currentCondition.label}</div>
              </div>
            </div>
            <div className="weather-location">
              <FiMapPin />
              <span>{location.label}</span>
            </div>
            <div className="weather-metrics">
              <span><FiThermometer /> Feels {Math.round(current.apparent_temperature)}{units.apparent_temperature}</span>
              <span><FiDroplet /> {current.relative_humidity_2m}{units.relative_humidity_2m}</span>
              <span><FiWind /> {Math.round(current.wind_speed_10m)} {units.wind_speed_10m}</span>
            </div>
          </div>

          <div className="weather-daily">
            {forecast.daily.time.map((day, index) => {
              const { label, Icon } = getCondition(forecast.daily.weather_code[index]);
              return (
                <div key={day} className="weather-day" title={label}>
                  <span className="weather-day-name">{formatDay(day, index)}</span>
                  <Icon className="weather-day-icon" />
                  <span className="weather-day-range">
                    <strong>{Math.round(forecast.daily.temperature_2m_max[index])}°</strong>
                    <span>{Math.round(forecast.daily.temperature_2m_min[index])}°</span>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </ToolModal>
  );
}

export default WeatherModal;
