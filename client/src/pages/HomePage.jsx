import { useEffect, useState } from "react";
import { getBackendHealth } from "../api/health";
import "../App.css";

function HomePage() {
  const isDev = import.meta.env.DEV;
  const [backendStatus, setBackendStatus] = useState("Checking...");

  useEffect(() => {
    if (!isDev) {
      return;
    }

    getBackendHealth()
      .then((data) => setBackendStatus(data.status))
      .catch(() => setBackendStatus("Offline"));
  }, [isDev]);

  return (
    <main className="landing-shell">
      <section className="landing-page">
        <header className="top-banner">
          <div className="brand-lockup">
            <p className="brand-name">Have A Byte</p>
            <p className="brand-city">AKL</p>
          </div>

          <button className="sign-in-link" type="button">
            Sign in
          </button>
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
