import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { createSession } from "../api/sessions";
import aucklandSkyBackground from "../assets/background - auckland - sky transparent 1.png";
import logoPointer from "../assets/Polygon 1.svg";
import { useAuth } from "../context/useAuth";
import "./RoomPage.css";

function CreateRoomPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isAuthReady, token } = useAuth();
  const [maxParticipantsInput, setMaxParticipantsInput] = useState("4");
  const [roomDisplayName, setRoomDisplayName] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthReady && !isAuthenticated) {
      navigate("/auth", {
        replace: true,
        state: { redirectTo: location.pathname },
      });
    }
  }, [isAuthReady, isAuthenticated, location.pathname, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");
    setIsSubmitting(true);

    try {
      const maxParticipants = Number(maxParticipantsInput);
      const { session } = await createSession(token, {
        maxParticipants,
        roomDisplayName: roomDisplayName.trim(),
      });
      navigate(`/sessions/${session.sessionCode}`, {
        replace: true,
        state: { inviteSession: session },
      });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCapacityChange(event) {
    const digitsOnly = event.target.value.replace(/\D/g, "");

    if (!digitsOnly) {
      setMaxParticipantsInput("");
      return;
    }

    const normalizedValue = String(Number(digitsOnly));
    setMaxParticipantsInput(normalizedValue);
  }

  function handleCapacityBlur() {
    const normalizedValue = Number(maxParticipantsInput);

    if (!Number.isInteger(normalizedValue) || normalizedValue < 2) {
      setMaxParticipantsInput("2");
      return;
    }

    if (normalizedValue > 50) {
      setMaxParticipantsInput("50");
      return;
    }

    setMaxParticipantsInput(String(normalizedValue));
  }

  if (!isAuthReady) {
    return <main className="room-page-shell room-page-status">Restoring session...</main>;
  }

  return (
    <main className="room-page-shell">
      <section className="room-page-frame">
        <div
          className="create-room-background"
          aria-hidden="true"
          style={{ "--create-room-background-image": `url("${aucklandSkyBackground}")` }}
        />

        <header className="top-banner">
          <button className="brand-lockup brand-lockup-button" type="button" onClick={() => navigate("/")}>
            <div className="brand-name" aria-label="PICK n GO AKL">
              <span className="brand-word brand-word-left">PICK</span>
              <span className="brand-word brand-word-connector">n</span>
              <span className="brand-word brand-word-right">GO</span>
            </div>
            <div className="brand-city">
              <span>AKL</span>
              <img src={logoPointer} alt="" aria-hidden="true" />
            </div>
          </button>
        </header>

        <section className="room-page-layout">
          <aside className="room-panel create-room-panel">
            <div className="auth-copy">
              <h2 className="room-page-title">Create a room</h2>
            </div>

            <form className="auth-form create-room-form" onSubmit={handleSubmit}>
              <label>
                <span>How others will see you in the room</span>
                <input
                  type="text"
                  maxLength="30"
                  value={roomDisplayName}
                  onChange={(event) => setRoomDisplayName(event.target.value)}
                  placeholder="Type your nickname"
                />
              </label>

              <label>
                <span>Maximum participants</span>
                <input
                  type="number"
                  min="2"
                  max="50"
                  value={maxParticipantsInput}
                  onChange={handleCapacityChange}
                  onBlur={handleCapacityBlur}
                />
              </label>

              <button className="cta-button auth-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Confirm"}
              </button>
            </form>

            {statusMessage ? <p className="auth-status success">{statusMessage}</p> : null}
            {errorMessage ? <p className="auth-status error">{errorMessage}</p> : null}
          </aside>
        </section>
      </section>
    </main>
  );
}

export default CreateRoomPage;
