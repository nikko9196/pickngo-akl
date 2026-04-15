import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { joinSession } from "../api/sessions";
import aucklandSkyBackground from "../assets/background - auckland - sky transparent 1.png";
import logoPointer from "../assets/Polygon 1.svg";
import { useAuth } from "../context/useAuth";
import "./RoomPage.css";

function JoinRoomPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionCode: sessionCodeParam } = useParams();
  const { isAuthenticated, isAuthReady, token } = useAuth();
  const [sessionCode, setSessionCode] = useState(sessionCodeParam || "");
  const [roomDisplayName, setRoomDisplayName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (sessionCodeParam) {
      setSessionCode(sessionCodeParam);
    }
  }, [sessionCodeParam]);

  useEffect(() => {
    if (isAuthReady && !isAuthenticated) {
      navigate("/auth", {
        replace: true,
        state: { redirectTo: location.pathname },
      });
    }
  }, [isAuthReady, isAuthenticated, location.pathname, navigate]);

  async function handleJoin(codeToJoin) {
    setErrorMessage("");
    setStatusMessage("");
    setIsSubmitting(true);

    try {
      const { session } = await joinSession(token, {
        sessionCode: codeToJoin.trim().toUpperCase(),
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

  async function handleSubmit(event) {
    event.preventDefault();
    await handleJoin(sessionCode);
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
              <h2 className="room-page-title">Join a room</h2>
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
                <span>Session code</span>
                <input
                  type="text"
                  maxLength="6"
                  value={sessionCode}
                  onChange={(event) => setSessionCode(event.target.value.toUpperCase())}
                  placeholder="ABC123"
                />
              </label>

              <button className="cta-button auth-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Joining..." : "Join"}
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

export default JoinRoomPage;
