import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getBackendHealth } from "../api/health";
import foodPatternBackground from "../assets/background - pattern - food 1.png";
import { useAuth } from "../context/useAuth";
import "../App.css";

function HomePage() {
  const isDev = import.meta.env.DEV;
  const navigate = useNavigate();
  const [backendStatus, setBackendStatus] = useState("Checking...");
  const { isAuthenticated, logout, user } = useAuth();

  useEffect(() => {
    if (!isDev) {
      return;
    }

    getBackendHealth()
      .then((data) => setBackendStatus(data.status))
      .catch(() => setBackendStatus("Offline"));
  }, [isDev]);

  const welcomeName = user?.displayName || user?.email || "Friend";
  const avatarLabel = welcomeName.trim().charAt(0).toUpperCase() || "U";

  return (
    <main className="landing-shell">
      <section className="landing-page">
        <div
          className="landing-pattern"
          aria-hidden="true"
          style={{ "--landing-background-image": `url("${foodPatternBackground}")` }}
        />
        <header className="top-banner">
          <div className="brand-lockup">
            <p className="brand-name">Have A Byte</p>
            <p className="brand-city">AKL</p>
          </div>

          {isAuthenticated ? (
            <div className="account-pill">
              {user?.avatarUrl ? (
                <img className="account-avatar" src={user.avatarUrl} alt={welcomeName} />
              ) : (
                <div className="account-avatar account-avatar-fallback" aria-hidden="true">
                  {avatarLabel}
                </div>
              )}
              <span>{welcomeName}</span>
              <button className="sign-in-link" type="button" onClick={logout}>
                Sign out
              </button>
            </div>
          ) : (
            <button
              className="sign-in-link"
              type="button"
              onClick={() => navigate("/auth")}
            >
              Sign in
            </button>
          )}
        </header>

        <section className="landing-hero">
          <div className="hero-text">
            <span className="hero-tag">Welcome</span>
            <h1>
              Let
              <span>Food</span>
              Bring
              <span>Us Together</span>
            </h1>
            <p>
              Pick a place to eat together in the easiest and most enjoyable
              way.
            </p>
          </div>

          <div className="hero-actions">
            <button className="cta-button" type="button">
              Join Room
            </button>
            <button className="cta-button secondary" type="button">
              Create Room
            </button>
          </div>
        </section>

        {isDev ? (
          <p className="debug-badge">Backend: {backendStatus}</p>
        ) : null}
      </section>
    </main>
  );
}

export default HomePage;
