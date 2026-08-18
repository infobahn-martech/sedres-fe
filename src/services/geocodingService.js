import axios from "axios";

// OpenStreetMap Nominatim — free, no API key required.
// Usage policy: https://operations.osmfoundation.org/policies/nominatim/
const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";

const NominatimGateway = axios.create({
  baseURL: NOMINATIM_BASE_URL,
  timeout: 10000,
  headers: {
    Accept: "application/json",
  },
});

const mapResultToLocation = (result) => ({
  address: result.display_name,
  name: result.display_name,
  placeId: String(result.place_id ?? ""),
  coordinates: {
    lat: Number(result.lat),
    lng: Number(result.lon),
  },
  addressComponents: result.address || {},
});

const searchAddress = async (query, { signal } = {}) => {
  if (!query || !query.trim()) return [];

  const { data } = await NominatimGateway.get("/search", {
    params: {
      q: query,
      format: "jsonv2",
      addressdetails: 1,
      limit: 5,
    },
    signal,
  });

  return Array.isArray(data) ? data.map(mapResultToLocation) : [];
};

const reverseGeocode = async (lat, lng, { signal } = {}) => {
  const { data } = await NominatimGateway.get("/reverse", {
    params: {
      lat,
      lon: lng,
      format: "jsonv2",
      addressdetails: 1,
    },
    signal,
  });

  if (!data || data.error) return null;
  return mapResultToLocation(data);
};

export default {
  searchAddress,
  reverseGeocode,
};
