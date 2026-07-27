import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { useGoogleMaps } from "../../../../../../../shared/hooks/useGoogleMaps";
import "../../../../../../../design/scss/location-map-picker.scss";

// Default map center: Jubail, Saudi Arabia (used until a location is searched or dragged)
const DEFAULT_CENTER = { lat: 27.0174, lng: 49.6225 };

const LocationMapPicker = ({ value, onChange, placeholder, className = "", hasError = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState(value || "");
  const [panelBox, setPanelBox] = useState({ top: 0, left: 0, width: 320 });
  const { isLoaded, error } = useGoogleMaps();

  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const searchInputRef = useRef(null);
  const mapDivRef = useRef(null);

  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const autocompleteRef = useRef(null);
  const geocoderRef = useRef(null);
  const mapReadyRef = useRef(false);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    setSearchText(value || "");
  }, [value]);

  const commitAddress = useCallback((address) => {
    setSearchText(address);
    onChangeRef.current({ target: { value: address } });
  }, []);

  const updatePanelPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    const width = Math.max(rect.width, 320);
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }
    setPanelBox({ top: rect.bottom + gap, left, width });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    updatePanelPosition();
    const onScrollOrResize = () => updatePanelPosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [isOpen, updatePanelPosition]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (event) => {
      const t = event.target;
      // Google injects its own suggestion dropdown (.pac-container) into <body>
      if (t.closest?.(".pac-container")) return;
      if (rootRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setIsOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const placeMarkerAt = useCallback((position) => {
    if (!mapRef.current) return;
    mapRef.current.setCenter(position);
    mapRef.current.setZoom(15);
    if (!markerRef.current) {
      markerRef.current = new window.google.maps.Marker({
        map: mapRef.current,
        position,
        draggable: true,
      });
      markerRef.current.addListener("dragend", () => {
        const pos = markerRef.current.getPosition();
        const latLng = { lat: pos.lat(), lng: pos.lng() };
        geocoderRef.current?.geocode({ location: latLng }, (results, status) => {
          if (status === "OK" && results?.[0]) {
            commitAddress(results[0].formatted_address);
          } else {
            console.warn(`[LocationMapPicker] Reverse geocode failed (status: ${status}). Falling back to coordinates. Check that the "Geocoding API" is enabled and billing is active for the Google Cloud project behind VITE_GOOGLE_MAPS_API_KEY.`);
            commitAddress(`${latLng.lat.toFixed(6)}, ${latLng.lng.toFixed(6)}`);
          }
        });
      });
    } else {
      markerRef.current.setPosition(position);
    }
  }, [commitAddress]);

  // Initialize the map + autocomplete + geocoder once per time the panel opens
  useEffect(() => {
    if (!isOpen || !isLoaded || error || mapReadyRef.current) return;
    if (!mapDivRef.current || !searchInputRef.current || !window.google?.maps) return;

    mapReadyRef.current = true;

    mapRef.current = new window.google.maps.Map(mapDivRef.current, {
      center: DEFAULT_CENTER,
      zoom: 11,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
    });
    geocoderRef.current = new window.google.maps.Geocoder();

    autocompleteRef.current = new window.google.maps.places.Autocomplete(searchInputRef.current, {
      types: ["geocode", "establishment"],
      fields: ["formatted_address", "geometry", "name"],
    });
    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current.getPlace();
      if (place?.geometry?.location) {
        placeMarkerAt(place.geometry.location);
      }
      if (place?.formatted_address) {
        commitAddress(place.formatted_address);
      }
    });

    if (value) {
      geocoderRef.current.geocode({ address: value }, (results, status) => {
        if (status === "OK" && results?.[0]?.geometry?.location) {
          placeMarkerAt(results[0].geometry.location);
        }
      });
    }

    return () => {
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
      if (markerRef.current) {
        window.google.maps.event.clearInstanceListeners(markerRef.current);
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      mapRef.current = null;
      geocoderRef.current = null;
      mapReadyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isLoaded, error]);

  const handleTriggerClick = () => {
    setSearchText(value || "");
    setIsOpen(true);
  };

  const handleSearchInputChange = (e) => {
    setSearchText(e.target.value);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") e.preventDefault();
  };

  const panel = isOpen && createPortal(
    <div
      ref={panelRef}
      className="location-map-picker-panel"
      style={{ top: panelBox.top, left: panelBox.left, width: panelBox.width }}
    >
      <input
        ref={searchInputRef}
        type="text"
        className="location-map-picker-search"
        value={searchText}
        onChange={handleSearchInputChange}
        onKeyDown={handleSearchKeyDown}
        placeholder="Search a location..."
        autoComplete="off"
        disabled={!isLoaded || !!error}
      />
      <div ref={mapDivRef} className="location-map-picker-map" />
      {error && <div className="location-map-picker-error">{error}</div>}
      {!isLoaded && !error && (
        <div className="location-map-picker-loading">Loading map...</div>
      )}
      {isLoaded && !error && (
        <div className="location-map-picker-hint">Drag the pin to fine-tune the pickup point</div>
      )}
    </div>,
    document.body
  );

  return (
    <div ref={rootRef} className={`location-map-picker ${className}`}>
      <div
        ref={triggerRef}
        className={`cf-input location-map-picker-trigger ${hasError ? "is-invalid" : ""}`}
        onClick={handleTriggerClick}
      >
        {value ? (
          <span className="location-map-picker-value">{value}</span>
        ) : (
          <span className="location-map-picker-placeholder">{placeholder || "Enter pick-up location..."}</span>
        )}
      </div>
      {panel}
    </div>
  );
};

LocationMapPicker.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  className: PropTypes.string,
  hasError: PropTypes.bool,
};

export default LocationMapPicker;
