import { useState, useEffect, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import geocodingService from "../../../../../../../services/geocodingService";
import "./LeafletLocationField.scss";

// Vite doesn't resolve Leaflet's default marker image paths, so point them at the
// bundled assets once, up front, instead of per-instance.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const SEARCH_DEBOUNCE_MS = 400;
const DEFAULT_CENTER = { lat: 26.2172, lng: 50.1971 }; // Dammam/Al Khobar area, Saudi Arabia

const MapClickHandler = ({ onSelect }) => {
  useMapEvents({
    click(e) {
      onSelect(e.latlng);
    },
  });
  return null;
};

MapClickHandler.propTypes = {
  onSelect: PropTypes.func.isRequired,
};

// MapContainer only applies center/zoom on first mount, so once a location is picked
// after the map is already open, the marker can end up placed outside the still-frozen
// viewport. Pan the live map instance imperatively whenever the marker position changes.
const RecenterOnPosition = ({ position }) => {
  const map = useMap();
  const prevPositionRef = useRef(null);

  useEffect(() => {
    if (!position) return;
    const prev = prevPositionRef.current;
    if (prev && prev.lat === position.lat && prev.lng === position.lng) return;
    prevPositionRef.current = position;
    map.setView([position.lat, position.lng], Math.max(map.getZoom(), 15));
  }, [position, map]);

  return null;
};

RecenterOnPosition.propTypes = {
  position: PropTypes.shape({
    lat: PropTypes.number,
    lng: PropTypes.number,
  }),
};

const LeafletLocationField = ({ value, onChange, placeholder, className = "", onLocationSelect, disabled = false }) => {
  const [inputValue, setInputValue] = useState(value || "");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [markerPosition, setMarkerPosition] = useState(null);

  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const onLocationSelectRef = useRef(onLocationSelect);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onLocationSelectRef.current = onLocationSelect;
  }, [onLocationSelect]);

  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const applyLocation = useCallback((location) => {
    setInputValue(location.address);
    setMarkerPosition(location.coordinates);
    setShowSuggestions(false);
    setSuggestions([]);
    onChangeRef.current({ target: { value: location.address } });
    onLocationSelectRef.current?.(location);
  }, []);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(e);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (!newValue.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      setIsSearching(true);
      try {
        const results = await geocodingService.searchAddress(newValue, { signal: controller.signal });
        setSuggestions(results);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleSuggestionClick = (location) => {
    applyLocation(location);
  };

  const handleMapSelect = async (latlng) => {
    setMarkerPosition({ lat: latlng.lat, lng: latlng.lng });
    try {
      const location = await geocodingService.reverseGeocode(latlng.lat, latlng.lng);
      if (location) {
        applyLocation(location);
      } else {
        const fallback = {
          address: `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`,
          name: `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`,
          placeId: "",
          coordinates: { lat: latlng.lat, lng: latlng.lng },
          addressComponents: {},
        };
        applyLocation(fallback);
      }
    } catch {
      // Reverse geocoding failed; marker still moved, address left untouched.
    }
  };

  const toggleMap = () => {
    setShowMap((prev) => !prev);
    setShowSuggestions(false);
  };

  const mapCenter = markerPosition || DEFAULT_CENTER;

  return (
    <div className={`cf-input leaflet-location-field ${className}`} ref={wrapperRef}>
      <div className="leaflet-location-field__anchor">
        <div className="leaflet-location-field__input-row">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder={placeholder || "Search for a location..."}
            disabled={disabled}
          />
          <button
            type="button"
            className="leaflet-location-field__map-toggle"
            onClick={toggleMap}
            disabled={disabled}
            title={showMap ? "Hide map" : "Pick on map"}
          >
            {showMap ? "Hide map" : "Map"}
          </button>
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <ul className="leaflet-location-field__suggestions">
            {suggestions.map((s) => (
              <li key={s.placeId || s.address} onClick={() => handleSuggestionClick(s)}>
                {s.address}
              </li>
            ))}
          </ul>
        )}

        {isSearching && <div className="leaflet-location-field__status">Searching...</div>}
      </div>

      {showMap && (
        <div className="leaflet-location-field__map">
          <MapContainer
            center={[mapCenter.lat, mapCenter.lng]}
            zoom={markerPosition ? 15 : 10}
            scrollWheelZoom={false}
            style={{ height: "180px", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onSelect={handleMapSelect} />
            <RecenterOnPosition position={markerPosition} />
            {markerPosition && (
              <Marker
                position={[markerPosition.lat, markerPosition.lng]}
                draggable
                eventHandlers={{
                  dragend: (e) => handleMapSelect(e.target.getLatLng()),
                }}
              />
            )}
          </MapContainer>
          <div className="leaflet-location-field__map-hint">Click on the map or drag the pin to set the location</div>
        </div>
      )}
    </div>
  );
};

LeafletLocationField.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  className: PropTypes.string,
  onLocationSelect: PropTypes.func,
  disabled: PropTypes.bool,
};

export default LeafletLocationField;
