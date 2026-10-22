import { useState, useEffect } from 'react';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const GOOGLE_MAPS_API_URL = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`;

// Google calls window.gm_authFailure when the key is rejected (invalid key, API
// not enabled, referrer not allowed, billing). It fires once per page, so the
// flag is module-level and subscribers are notified when it happens.
let hasAuthFailed = false;
const authFailureListeners = new Set();

if (typeof window !== 'undefined') {
    const previousAuthFailure = window.gm_authFailure;
    window.gm_authFailure = () => {
        hasAuthFailed = true;
        authFailureListeners.forEach((listener) => listener());
        previousAuthFailure?.();
    };
}

export const useGoogleMaps = () => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(null);
    const [authFailed, setAuthFailed] = useState(hasAuthFailed);

    useEffect(() => {
        const handleAuthFailure = () => setAuthFailed(true);
        authFailureListeners.add(handleAuthFailure);
        return () => authFailureListeners.delete(handleAuthFailure);
    }, []);

    useEffect(() => {
        // Check if Google Maps is already loaded
        if (window.google && window.google.maps && window.google.maps.places) {
            setIsLoaded(true);
            return;
        }

        // Check if script is already being loaded
        const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
        if (existingScript) {
            existingScript.addEventListener('load', () => setIsLoaded(true));
            existingScript.addEventListener('error', () => setError('Failed to load Google Maps'));
            return;
        }

        // Only load if API key is provided
        if (!GOOGLE_MAPS_API_KEY) {
            setError('Google Maps API key is not configured. Please add VITE_GOOGLE_MAPS_API_KEY to your .env file.');
            return;
        }

        // Create and load the script
        const script = document.createElement('script');
        script.src = GOOGLE_MAPS_API_URL;
        script.async = true;
        script.defer = true;

        script.onload = () => {
            setIsLoaded(true);
            setError(null);
        };

        script.onerror = () => {
            setError('Failed to load Google Maps script');
            setIsLoaded(false);
        };

        document.head.appendChild(script);

        return () => {
            // Cleanup: remove script if component unmounts (optional)
            // Note: We might want to keep it for other components
        };
    }, []);

    return { isLoaded, error, authFailed };
};

export default useGoogleMaps;

