import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { getSessionByCode, updateSessionStatus } from "../api/sessions";
import aucklandSkyBackground from "../assets/background - auckland - sky transparent 1.png";
import logoPointer from "../assets/Polygon 1.svg";
import { useAuth } from "../context/useAuth";
import "./SessionPage.css";

function SessionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionCode } = useParams();
  const initialSession = location.state?.inviteSession || null;
  const { isAuthenticated, isAuthReady, token, user } = useAuth();
  const [session, setSession] = useState(initialSession);
  const [statusMessage, setStatusMessage] = useState("");
  const [copiedField, setCopiedField] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(!location.state?.inviteSession);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(
    location.state?.inviteSession?.currentUserRole === "host"
  );
  const [brokenAvatarUrls, setBrokenAvatarUrls] = useState({});

  useEffect(() => {
    if (isAuthReady && !isAuthenticated) {
      navigate("/auth", {
        replace: true,
        state: { redirectTo: location.pathname },
      });
    }
  }, [isAuthReady, isAuthenticated, location.pathname, navigate]);

  useEffect(() => {
    if (!isAuthReady || !isAuthenticated || !token || !sessionCode) {
      return;
    }

    let ignore = false;

    async function loadSession(options = {}) {
      const { showLoader = false } = options;

      if (showLoader) {
        setIsLoading(true);
      }

      try {
        const { session: nextSession } = await getSessionByCode(token, sessionCode);

        if (ignore) {
          return;
        }

        setSession(nextSession);
        setErrorMessage("");
      } catch (error) {
        if (!ignore) {
          setErrorMessage(error.message);
        }
      } finally {
        if (!ignore && showLoader) {
          setIsLoading(false);
        }
      }
    }

    loadSession({ showLoader: !initialSession });
    const intervalId = window.setInterval(() => {
      loadSession();
    }, 3000);

    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, [initialSession, isAuthReady, isAuthenticated, sessionCode, token]);

  useEffect(() => {
    if (!session || session.status === "waiting") {
      return;
    }

    const statusRoutes = {
      questioning: `/sessions/${session.sessionCode}/question`,
      generating: `/sessions/${session.sessionCode}/recommendation`,
      selecting: `/sessions/${session.sessionCode}/recommendation`,
      spinning: `/sessions/${session.sessionCode}/wheel`,
      voting: `/sessions/${session.sessionCode}/wheel`,
      completed: `/sessions/${session.sessionCode}/result`,
    };
    const nextPath = statusRoutes[session.status] || `/sessions/${session.sessionCode}/recommendation`;

    if (location.pathname === nextPath) {
      return;
    }

    if (session) {
      navigate(nextPath, {
        replace: true,
        state: { inviteSession: session },
      });
    }
  }, [location.pathname, navigate, session]);

  const qrCodeUrl = useMemo(() => {
    if (!session?.joinUrl) {
      return "";
    }

    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(session.joinUrl)}`;
  }, [session]);

  async function handleCopy(value, label, options = {}) {
    const { showSuccessMessage = true } = options;

    try {
      await navigator.clipboard.writeText(value);
      setStatusMessage(showSuccessMessage ? `${label} copied.` : "");
      setCopiedField(label);
      window.setTimeout(() => {
        setCopiedField((current) => (current === label ? "" : current));
      }, 1200);
    } catch {
      setStatusMessage(`Unable to copy ${label.toLowerCase()}.`);
    }
  }

  async function handleStartSession() {
    if (!session || !token) {
      return;
    }

    setErrorMessage("");
    setStatusMessage("");
    setIsStartingSession(true);

    try {
      const { session: nextSession } = await updateSessionStatus(token, session.id, {
        status: "questioning",
      });
      setSession(nextSession);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsStartingSession(false);
    }
  }

  function handleParticipantAvatarError(participantId, avatarUrl) {
    if (!avatarUrl) {
      return;
    }

    setBrokenAvatarUrls((current) =>
      current[participantId] ? current : { ...current, [participantId]: true }
    );
  }

  if (!isAuthReady) {
    return <main className="room-page-shell room-page-status">Restoring session...</main>;
  }

  return (
    <main className="session-shell create-room-shell">
      <section className="session-page-frame">
        <div
          className="session-page-background"
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

        {isLoading && !session ? (
          <section className="session-loading-state" aria-live="polite">
            <p>Loading room...</p>
          </section>
        ) : (
          <section className="session-layout session-page-layout">
            <section className="session-panel session-page-panel">
              <div className="session-panel-head">
                <h2>People in this room</h2>
                {session?.status === "waiting" ? (
                  <p className="session-waiting-badge">
                    <strong>
                      {session.participantCount}/{session.maxParticipants}
                    </strong>{" "}
                    waiting
                  </p>
                ) : null}
              </div>

              {session?.maxSelectionsPerUser ? (
                <p className="session-config-note">
                  Each person can shortlist up to <strong>{session.maxSelectionsPerUser}</strong>{" "}
                  recommendation{session.maxSelectionsPerUser === 1 ? "" : "s"} later.
                </p>
              ) : null}

              {isLoading ? <p className="account-dropdown-state">Loading participants...</p> : null}
              {errorMessage ? <p className="auth-status error">{errorMessage}</p> : null}
              {statusMessage ? <p className="auth-status success">{statusMessage}</p> : null}

              <div className="participant-list">
                {session?.participants.map((participant) => {
                  const participantInitial =
                    participant.roomDisplayName?.trim().charAt(0).toUpperCase() || "U";
                  const isCurrentUser = participant.userId === user?.id;
                  const showAvatarImage =
                    participant.avatarUrl && !brokenAvatarUrls[participant.userId];

                  return (
                    <article
                      className={`participant-card${isCurrentUser ? " participant-card-current" : ""}`}
                      key={participant.userId}
                    >
                      {showAvatarImage ? (
                        <img
                          className="participant-avatar"
                          src={participant.avatarUrl}
                          alt={participant.roomDisplayName}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            handleParticipantAvatarError(participant.userId, participant.avatarUrl)
                          }
                        />
                      ) : (
                        <div className="participant-avatar participant-avatar-fallback" aria-hidden="true">
                          {participantInitial}
                        </div>
                      )}

                      <div className="participant-copy">
                        <div className="participant-name-row">
                          <strong>{participant.roomDisplayName}</strong>
                          <span>{participant.role === "host" ? "Host" : "Member"}</span>
                        </div>
                      </div>

                    </article>
                  );
                })}
              </div>

              {session?.status === "waiting" && session.currentUserRole !== "host" ? (
                <p className="session-waiting-note">Waiting for host to start.</p>
              ) : null}
            </section>

            {session?.status === "waiting" && session.currentUserRole === "host" ? (
              <div className="session-page-panel session-start-actions">
                <button
                  className="cta-button session-start-button"
                  type="button"
                  onClick={handleStartSession}
                  disabled={isStartingSession || session.participantCount < 2}
                >
                  {isStartingSession ? "Starting..." : "Start"}
                </button>
              </div>
            ) : null}
          </section>
        )}

        {session?.currentUserRole === "host" ? (
          <button
            className="session-share-floating"
            type="button"
            onClick={() => setIsInviteModalOpen(true)}
            aria-label="Share room"
          >
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <path
                d="M30 12 52 30 30 48V37.5c-8.8 0-15.8 3.3-20.8 9.8.9-12.8 9.1-21 20.8-23.2V12Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
      </section>

      {isInviteModalOpen && session ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsInviteModalOpen(false)}>
          <section
            className="room-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Room invite details"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="room-modal-copy">
              <span className="hero-tag">Room ready</span>
              <h2>Share this room</h2>
            </div>

            {statusMessage ? <p className="auth-status success room-modal-status">{statusMessage}</p> : null}

            <div className="room-share-block">
              <strong>Session code</strong>
              <button
                className="room-share-row room-share-copy"
                type="button"
                onClick={() => handleCopy(session.sessionCode, "Session code")}
                data-copy-label={copiedField === "Session code" ? "Copied" : "Copy"}
              >
                <span>{session.sessionCode}</span>
              </button>
            </div>

            <div className="room-share-block">
              <strong>Invite link</strong>
              <div className="room-qr-block">
                <img src={qrCodeUrl} alt="Room invite QR code" />
              </div>
              <button
                className="room-share-row room-share-copy"
                type="button"
                onClick={() => handleCopy(session.joinUrl, "Invite link", { showSuccessMessage: false })}
                data-copy-label={copiedField === "Invite link" ? "Copied" : "Copy"}
              >
                <span>{session.joinUrl}</span>
              </button>
            </div>

            <div className="room-modal-actions">
              <button
                className="cta-button secondary room-modal-button"
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default SessionPage;
