import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import {
  generateRecommendations,
  getRecommendations,
  saveMySelections,
} from "../api/recommendations";
import { getSessionByCode } from "../api/sessions";
import logoPointer from "../assets/Polygon 1.svg";
import RestaurantCard from "../components/RestaurantCard";
import { useAuth } from "../context/useAuth";
import {
  mockGenerateRecommendations,
  mockGetRecommendations,
} from "../utils/mockRecommendations";
import "./RecommendationPage.css";

const USE_MOCK = import.meta.env.VITE_USE_MOCK_RECOMMENDATIONS === "true";
const NO_SNAPSHOT_MESSAGE = "No recommendation snapshot has been generated yet.";

function RecommendationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionCode } = useParams();
  const initialSession = location.state?.inviteSession || null;
  const { isAuthenticated, isAuthReady, token } = useAuth();
  const autoGenerateAttemptedRef = useRef(false);

  const [session, setSession] = useState(initialSession);
  const [items, setItems] = useState([]);
  const [selectedPlaceIds, setSelectedPlaceIds] = useState([]);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState("");

  const selectedSet = useMemo(
    () => new Set(selectedPlaceIds),
    [selectedPlaceIds]
  );

  const maxSelections = session?.maxSelectionsPerUser ?? 3;
  const isHost = session?.currentUserRole === "host";
  const hasRecommendations = items.length > 0;
  const shouldAutoGenerate =
    !USE_MOCK &&
    isHost &&
    session?.status === "generating" &&
    !hasSnapshot &&
    !isGenerating;

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (!isAuthenticated || !token) {
      navigate("/auth");
    }
  }, [isAuthReady, isAuthenticated, navigate, token]);

  useEffect(() => {
    autoGenerateAttemptedRef.current = false;
  }, [session?.id]);

  useEffect(() => {
    if (!session) {
      return;
    }

    if (session.status === "waiting") {
      navigate(`/sessions/${session.sessionCode}`, {
        replace: true,
        state: { inviteSession: session },
      });
      return;
    }

    if (session.status === "questioning") {
      navigate(`/sessions/${session.sessionCode}/question`, {
        replace: true,
        state: { inviteSession: session },
      });
    }
  }, [navigate, session]);

  useEffect(() => {
    if (!isAuthReady || !isAuthenticated || !token || !sessionCode) {
      return;
    }

    let ignore = false;

    async function loadRecommendationState(options = {}) {
      const { showLoader = false } = options;

      if (showLoader) {
        setIsLoading(true);
      }

      try {
        const sessionResponse = await getSessionByCode(token, sessionCode);

        if (ignore) {
          return;
        }

        const nextSession = sessionResponse.session;
        setSession(nextSession);
        setPageError("");

        try {
          const recommendationsResponse = USE_MOCK
            ? await mockGetRecommendations()
            : await getRecommendations(token, nextSession.id);

          if (ignore) {
            return;
          }

          const nextItems = USE_MOCK
            ? recommendationsResponse.items || []
            : recommendationsResponse.snapshot?.restaurants || [];

          setItems(nextItems);
          setHasSnapshot(true);
        } catch (error) {
          if (ignore) {
            return;
          }

          if (error.message === NO_SNAPSHOT_MESSAGE) {
            setItems([]);
            setHasSnapshot(false);
            return;
          }

          throw error;
        }
      } catch (error) {
        if (!ignore) {
          setPageError(error.message);
        }
      } finally {
        if (!ignore && showLoader) {
          setIsLoading(false);
        }
      }
    }

    void loadRecommendationState({ showLoader: true });

    const intervalId = window.setInterval(() => {
      const shouldPoll =
        session?.status === "generating" ||
        (!hasSnapshot && session?.status === "selecting");

      if (shouldPoll) {
        void loadRecommendationState();
      }
    }, 3000);

    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, [
    hasSnapshot,
    isAuthReady,
    isAuthenticated,
    session?.status,
    sessionCode,
    token,
  ]);

  async function handleGenerate(options = {}) {
    if (!session || !token) {
      return;
    }

    const { isAutomatic = false } = options;

    setIsGenerating(true);
    setPageError("");

    try {
      const response = USE_MOCK
        ? await mockGenerateRecommendations()
        : await generateRecommendations(token, session.id, { refresh: true });

      const nextItems = USE_MOCK
        ? response.items || []
        : response.snapshot?.restaurants || [];
      const nextSessionStatus = response.sessionStatus || session.status;

      setItems(nextItems);
      setHasSnapshot(true);
      setSession((currentSession) =>
        currentSession
          ? { ...currentSession, status: nextSessionStatus }
          : currentSession
      );
    } catch (error) {
      setPageError(error.message);

      if (isAutomatic) {
        autoGenerateAttemptedRef.current = true;
      }
    } finally {
      setIsGenerating(false);
    }
  }

  useEffect(() => {
    if (!shouldAutoGenerate || autoGenerateAttemptedRef.current) {
      return;
    }

    autoGenerateAttemptedRef.current = true;
    void handleGenerate({ isAutomatic: true });
  }, [shouldAutoGenerate]);

  function handleToggle(placeId) {
    setSelectedPlaceIds((current) => {
      if (current.includes(placeId)) {
        return current.filter((id) => id !== placeId);
      }

      if (current.length >= maxSelections) {
        return current;
      }

      return [...current, placeId];
    });
  }

  async function handleClose() {
  if (selectedPlaceIds.length === 0) {
    setPageError("Please select at least one restaurant before closing.");
    return;
  }

  setIsSubmitting(true);
  setPageError("");

  try {
    if (!USE_MOCK) {
      await saveMySelections(token, session.id, selectedPlaceIds);
    }
    navigate(`/sessions/${sessionCode}/wheel`);
  } catch (error) {
    setPageError(error.message);
  } finally {
    setIsSubmitting(false);
  }
}

  return (
    <main className="recommendation-shell">
      <header className="top-banner">
        <button
          className="brand-lockup brand-lockup-button"
          type="button"
          onClick={() => navigate("/")}
        >
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

      {!isAuthReady || isLoading ? (
        <div className="recommendation-state">
          <div className="recommendation-spinner" aria-hidden="true" />
          <p>Loading recommendations...</p>
        </div>
      ) : pageError && !hasRecommendations && !hasSnapshot ? (
        <div className="recommendation-state">
          <p className="recommendation-error">{pageError}</p>
          <button
            className="recommendation-retry"
            type="button"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      ) : isGenerating ? (
        <div className="recommendation-state">
          <div className="recommendation-spinner" aria-hidden="true" />
          <p>Generating recommendations...</p>
          <small>This may take up to 30 seconds.</small>
        </div>
      ) : !hasRecommendations ? (
        <div className="recommendation-container">
          <section className="recommendation-intro">
            <h2>Picks for your group</h2>
            <p className="recommendation-intro-sub">
              {hasSnapshot
                ? "No restaurants matched the current preferences."
                : "No recommendations yet."}
            </p>
          </section>
          <div className="recommendation-state">
            {pageError ? (
              <p className="recommendation-error recommendation-error-banner">
                {pageError}
              </p>
            ) : null}
            {isHost ? (
              <>
                <p>
                  {hasSnapshot
                    ? "Try generating another recommendation set."
                    : "Generate restaurant recommendations for your group."}
                </p>
                <button
                  className="recommendation-generate"
                  type="button"
                  onClick={() => handleGenerate({ isAutomatic: false })}
                >
                  {hasSnapshot ? "Generate Again" : "Generate Recommendations"}
                </button>
              </>
            ) : (
              <p>
                {session?.status === "generating"
                  ? "Waiting for the host to generate recommendations..."
                  : "Recommendations are not available yet."}
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="recommendation-container">
            <section className="recommendation-intro">
              <h2>Picks for your group</h2>
              <p className="recommendation-intro-sub">
                Selected: {selectedPlaceIds.length}/{maxSelections} places
              </p>
            </section>

            {pageError ? (
              <p className="recommendation-error recommendation-error-banner">
                {pageError}
              </p>
            ) : null}

            <section className="recommendation-list">
              {items.map((item) => {
                const isSelected = selectedSet.has(item.placeId);
                const isDisabled =
                  !isSelected && selectedPlaceIds.length >= maxSelections;

                return (
                  <RestaurantCard
                    key={item.placeId}
                    item={item}
                    isSelected={isSelected}
                    isDisabled={isDisabled}
                    onToggle={handleToggle}
                  />
                );
              })}
            </section>
          </div>

          <div className="recommendation-footer">
            <button
              className="recommendation-close"
              type="button"
              onClick={handleClose}
              disabled={selectedPlaceIds.length === 0 || isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Close"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}

export default RecommendationPage;
