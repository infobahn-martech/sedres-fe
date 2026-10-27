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

// With `loading=async` the script's onload fires before the places library is
// ready, so resolve only after importLibrary('places'). One shared promise per
// page means late subscribers never miss an already-fired load event.
let loaderPromise = null;

const loadGoogleMaps = () => {
    if (!loaderPromise) {
        loaderPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = GOOGLE_MAPS_API_URL;
            script.async = true;
            script.onload = () => window.google.maps.importLibrary('places').then(resolve, reject);
            script.onerror = () => reject(new Error('Failed to load Google Maps script'));
            document.head.appendChild(script);
        }).catch((err) => {
            loaderPromise = null;
            throw err;
        });
    }
    return loaderPromise;
};

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
        if (window.google?.maps?.places) {
            setIsLoaded(true);
            return undefined;
        }

        if (!GOOGLE_MAPS_API_KEY) {
            setError('Google Maps API key is not configured. Please add VITE_GOOGLE_MAPS_API_KEY to your .env file.');
            return undefined;
        }

        let cancelled = false;
        loadGoogleMaps()
            .then(() => {
                if (!cancelled) setIsLoaded(true);
            })
            .catch((err) => {
                if (!cancelled) setError(err.message || 'Failed to load Google Maps');
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return { isLoaded, error, authFailed };
};

export default useGoogleMaps;

