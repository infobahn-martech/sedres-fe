import { useNavigate } from "react-router-dom";
import "../../design/scss/pages/not-found/NotFound.scss";

const NotFound = () => {
  const navigate = useNavigate();

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
          <div className="error-code">404</div>
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
          <h1 className="not-found-title">Page Not Found</h1>
          <p className="not-found-description">
            Oops! The page you're looking for doesn't exist. It might have been
            moved, deleted, or you entered the wrong URL.
          </p>
        </div>

        <div className="not-found-actions">
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
