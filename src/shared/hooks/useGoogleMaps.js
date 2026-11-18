import { useState, useEffect } from 'react';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const GOOGLE_MAPS_CALLBACK = '__sedresGoogleMapsReady';
const GOOGLE_MAPS_API_URL = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&loading=async&callback=${GOOGLE_MAPS_CALLBACK}`;

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

// With `loading=async`, script.onload fires before the API is initialised, so we wait for
// Google's `callback` (called once google.maps is ready), then load the Places library.
// One shared promise per page means late subscribers never miss the load.
let loaderPromise = null;
const LOAD_TIMEOUT_MS = 20000;

const loadPlacesLibrary = async () => {
    if (window.google?.maps?.places) return;
    if (typeof window.google?.maps?.importLibrary === 'function') {
        await window.google.maps.importLibrary('places');
    }
    if (!window.google?.maps?.places) {
        throw new Error('Location suggestions unavailable (Places library not loaded).');
    }
};

const loadGoogleMaps = () => {
    if (!loaderPromise) {
        loaderPromise = new Promise((resolve, reject) => {
            // Never hang on "Loading…": a stalled/blocked request (ad blocker, firewall,
            // offline) may fire neither the callback nor onerror.
            const timeoutId = setTimeout(
                () => reject(new Error('Location suggestions unavailable (Google Maps timed out).')),
                LOAD_TIMEOUT_MS
            );

            window[GOOGLE_MAPS_CALLBACK] = () => {
                loadPlacesLibrary().then(
                    () => {
                        clearTimeout(timeoutId);
                        resolve();
                    },
                    (err) => {
                        clearTimeout(timeoutId);
                        reject(err);
                    }
                );
            };

            const script = document.createElement('script');
            script.src = GOOGLE_MAPS_API_URL;
            script.async = true;
            script.onerror = () => {
                clearTimeout(timeoutId);
                script.remove();
                reject(new Error('Failed to load Google Maps script'));
            };
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

