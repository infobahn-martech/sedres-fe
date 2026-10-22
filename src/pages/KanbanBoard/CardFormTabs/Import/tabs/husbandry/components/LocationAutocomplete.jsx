import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { useGoogleMaps } from "../../../../../../../shared/hooks/useGoogleMaps";

const LocationAutocomplete = ({ value, onChange, placeholder, className = "", onLocationSelect, disabled = false }) => {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const onLocationSelectRef = useRef(onLocationSelect);
  const { isLoaded, error, authFailed } = useGoogleMaps();
  const [inputValue, setInputValue] = useState(value || "");

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
    if (!isLoaded || !inputRef.current || error || authFailed) return;

    if (!autocompleteRef.current && window.google?.maps?.places) {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        inputRef.current,
        {
          types: ['geocode', 'establishment'],
          fields: ['formatted_address', 'geometry', 'name', 'place_id', 'address_components'],
        }
      );

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();

        if (place?.formatted_address) {
          const locationData = {
            address: place.formatted_address,
            name: place.name || place.formatted_address,
            placeId: place.place_id,
            coordinates: place.geometry?.location ? {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            } : null,
            addressComponents: place.address_components || [],
          };

          setInputValue(place.formatted_address);
          onChangeRef.current({ target: { value: place.formatted_address } });
          onLocationSelectRef.current?.(locationData);
        }
      });
    }

    return () => {
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [isLoaded, error, authFailed]);

  // On key rejection Google disables the input and swaps its placeholder for
  // "Sorry! Something went wrong." directly on the DOM node. Undo that so the
  // field keeps working as a plain text input without suggestions.
  useEffect(() => {
    const input = inputRef.current;
    if (!authFailed || !input) return;
    input.disabled = disabled;
    input.placeholder = placeholder || "Search for a location...";
    input.classList.remove("gm-err-autocomplete");
    input.style.backgroundImage = "";
  }, [authFailed, disabled, placeholder]);

  // The pac-container is positioned via the input's bounding rect at open time and
  // only repositions on window scroll, so scrolling an internal panel leaves it
  // floating in the wrong place. Close it on any scroll outside the dropdown itself.
  useEffect(() => {
    if (!isLoaded) return undefined;

    const handleScroll = (event) => {
      if (event.target?.closest?.(".pac-container")) return;
      if (document.activeElement === inputRef.current) {
        inputRef.current.blur();
      }
    };

    document.addEventListener("scroll", handleScroll, true);
    return () => document.removeEventListener("scroll", handleScroll, true);
  }, [isLoaded]);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(e);
  };

  return (
    <div className={`cf-input location-autocomplete ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder || "Search for a location..."}
        disabled={disabled || !isLoaded || !!error}
      />
      {error && (
        <div className="location-autocomplete-error">
          {error}
        </div>
      )}
      {!isLoaded && !error && (
        <div className="location-autocomplete-loading">
          Loading location services...
        </div>
      )}
    </div>
  );
};

LocationAutocomplete.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  className: PropTypes.string,
  onLocationSelect: PropTypes.func, // Optional callback with full location data
  disabled: PropTypes.bool,
};

export default LocationAutocomplete;

