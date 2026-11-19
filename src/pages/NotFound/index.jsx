import { useEffect } from "react";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";
import "../../design/scss/pages/not-found/NotFound.scss";
import { isChunkLoadError, reloadOnceForChunkError } from "../../shared/helpers/chunkReload";

const NotFound = () => {
  const navigate = useNavigate();
  // Also used as the router's errorElement: only a real "no route matched"
  // (or an explicit 404 response) is a 404; anything else is a crash.
  const routeError = useRouteError();
  const isNotFound =
    !routeError || (isRouteErrorResponse(routeError) && routeError.status === 404);
  const isChunkError = !isNotFound && isChunkLoadError(routeError);

  useEffect(() => {
    if (!isNotFound) console.error("Route error:", routeError);
    if (isChunkError) reloadOnceForChunkError();
  }, [isNotFound, isChunkError, routeError]);

  const handleGoHome = () => {
    navigate("/");
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="not-found-container">
      <div className="not-found-content">
        <div className="not-found-illustration">
          <div className="error-code">{isNotFound ? "404" : "Oops"}</div>
          <div className="error-icon">
            <svg
              width="200"
              height="200"
              viewBox="0 0 200 200"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="100"
                cy="100"
                r="80"
                stroke="#00368c"
                strokeWidth="3"
                strokeDasharray="8 8"
                fill="none"
              />
              <path
                d="M60 100L140 100M100 60L100 140"
                stroke="#00368c"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <circle
                cx="100"
                cy="100"
                r="40"
                stroke="#00368c"
                strokeWidth="2"
                fill="none"
                opacity="0.3"
              />
            </svg>
          </div>
        </div>

        <div className="not-found-text">
          {isNotFound ? (
            <>
              <h1 className="not-found-title">Page Not Found</h1>
              <p className="not-found-description">
                Oops! The page you're looking for doesn't exist. It might have been
                moved, deleted, or you entered the wrong URL.
              </p>
            </>
          ) : (
            <>
              <h1 className="not-found-title">Something went wrong</h1>
              <p className="not-found-description">
                {isChunkError
                  ? "A new version of the app is available. Please reload the page."
                  : "An unexpected error occurred. Reloading the page usually fixes it."}
              </p>
            </>
          )}
        </div>

        <div className="not-found-actions">
          {!isNotFound && (
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          )}
          <button className="btn btn-primary" onClick={handleGoHome}>
            Go to Home
          </button>
          <button className="btn btn-outline btn-login" onClick={handleGoBack}>
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
