import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import {
  generateRecommendations,
  getRecommendations,
  getMySelections,
  saveMySelections,
} from "../api/recommendations";
import { getSessionByCode } from "../api/sessions";
import Navbar from "../components/Navbar";
import RestaurantCard from "../components/RestaurantCard";
import { useAuth } from "../context/useAuth";
import {
  mockGenerateRecommendations,
  mockGetRecommendations,
} from "../utils/mockRecommendations";
import "./RecommendationPage.css";

// import socket and reminder components and hook
import ReminderPopup from "../components/ReminderPopup";
import { useReminderPopup } from "../hooks/useReminderPopup";
import { io } from "socket.io-client";
import { getCurrentUser } from "../api/auth";

const socket = io(import.meta.env.VITE_API_BASE_URL);
function isMissingResponsesError(message) {
  return /questionnaire responses|usable responses/i.test(message ?? "");
}

const USE_MOCK = import.meta.env.VITE_USE_MOCK_RECOMMENDATIONS === "true";

function RecommendationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionCode } = useParams();
  const initialSession = location.state?.inviteSession || null;
  const { isAuthenticated, isAuthReady, token } = useAuth();
  const autoGenerateAttemptedRef = useRef(false);
  const generateErrorRef = useRef(null);
  const lastSuccessfulPollRef = useRef(Date.now());

  const [session, setSession] = useState(initialSession);
  const [items, setItems] = useState([]);
  const [selectedPlaceIds, setSelectedPlaceIds] = useState([]);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState("");
  const [hasWaitedTooLong, setHasWaitedTooLong] = useState(false);

  const selectedSet = useMemo(
    () => new Set(selectedPlaceIds),
    [selectedPlaceIds]
  );

  const maxSelections = session?.maxSelectionsPerUser ?? 3;
  const effectiveMax = Math.min(maxSelections, items.length);
  const isHost = session?.currentUserRole === "host";
  const hasRecommendations = items.length > 0;
  const shouldAutoGenerate =
    !USE_MOCK &&
    isHost &&
    session?.status === "generating" &&
    !hasSnapshot &&
    !isGenerating;

  // ============================================================
  // Reminder State and EFFECTS
 
  const [currentUserId, setCurrentUserId] = useState(null);
  const currentUserIdRef = useRef(null);

  useEffect(() => {
      const fetchMe = async () => {
          try {
              const { user } = await getCurrentUser(token);
              setCurrentUserId(user.id);
          } catch (err) {
              console.error(err);
          }
      };

      if (token) {
          fetchMe();
      }
  }, [token]);

  useEffect(() => {
      currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    if (!sessionCode || !currentUserId) return;

    socket.emit("join_session", {
        sessionCode,
        userId: currentUserId
    });

  }, [sessionCode, currentUserId]);

  const {
      showReminderPopup,
      setShowReminderPopup,
  } = useReminderPopup(socket, currentUserIdRef);

  // End of Reminder State and EFFECTS
  // ============================================================

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
    generateErrorRef.current = null;
    lastSuccessfulPollRef.current = Date.now();
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
    if (
      isHost ||
      session?.status !== "generating" ||
      hasRecommendations ||
      hasSnapshot
    ) {
      setHasWaitedTooLong(false);
      return;
    }

    const checkIntervalId = window.setInterval(() => {
      const millisecondsSinceLastPoll = Date.now() - lastSuccessfulPollRef.current;
      if (millisecondsSinceLastPoll > 30000) {
        setHasWaitedTooLong(true);
      }
    }, 3000);

    return () => {
      window.clearInterval(checkIntervalId);
    };
  }, [isHost, session?.status, hasRecommendations, hasSnapshot]);

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

        lastSuccessfulPollRef.current = Date.now();
        const nextSession = sessionResponse.session;
        setSession(nextSession);
        setPageError(generateErrorRef.current ?? "");

        try {
          const recommendationsResponse = USE_MOCK
            ? await mockGetRecommendations()
            : await getRecommendations(token, nextSession.id);

          if (ignore) {
            return;
          }

          // Handle 200 + null pattern from backend
          if (!USE_MOCK && recommendationsResponse.snapshot === null) {
            setItems([]);
            setHasSnapshot(false);
            setSelectedPlaceIds([]);
            return;
          }

          const nextItems = USE_MOCK
            ? recommendationsResponse.items || []
            : recommendationsResponse.snapshot?.restaurants || [];

          setItems(nextItems);
          setHasSnapshot(true);

          if (!USE_MOCK) {
            const selectionsResponse = await getMySelections(token, nextSession.id);

            if (ignore) {
              return;
            }

            // Handle 200 + null pattern from backend (PR #93)
            if (selectionsResponse.selection === null) {
              setSelectedPlaceIds([]);
            } else {
              const validPlaceIds = new Set(nextItems.map((item) => item.placeId));
              const savedPlaceIds = (selectionsResponse.selection?.selections || [])
                .map((selection) => selection.placeId)
                .filter((placeId) => validPlaceIds.has(placeId));

              setSelectedPlaceIds(savedPlaceIds);
            }
          }
        } catch (error) {
          if (ignore) {
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
    generateErrorRef.current = null;

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
      setSelectedPlaceIds((current) =>
        current.filter((placeId) =>
          nextItems.some((item) => item.placeId === placeId)
        )
      );
      setSession((currentSession) =>
        currentSession
          ? { ...currentSession, status: nextSessionStatus }
          : currentSession
      );
    } catch (error) {
      setPageError(error.message);

      if (isMissingResponsesError(error.message)) {
        generateErrorRef.current = error.message;
      }

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

      if (current.length >= effectiveMax) {
        return current;
      }

      return [...current, placeId];
    });
  }

  async function handleClose() {
    if (!session || !token) {
      return;
    }

    if (selectedPlaceIds.length === 0) {
      setPageError("Please select at least one restaurant before closing.");
      return;
    }

    setIsSubmitting(true);
    setPageError("");

    try {
      await saveMySelections(token, session.id, selectedPlaceIds);

      navigate(`/sessions/${sessionCode}/wheel`);
    } catch (error) {
      setPageError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="recommendation-shell">
      <Navbar variant="brand" />

      {!isAuthReady || isLoading ? (
        <div className="recommendation-state">
          <div className="recommendation-spinner" aria-hidden="true" />
          <p>Loading recommendations...</p>
        </div>
      ) : isMissingResponsesError(pageError) || (!isHost && hasWaitedTooLong) ? (
        <div className="recommendation-state">
          <p>
            Recommendations are not ready yet. You can keep waiting, or return home and re-open this session later.
          </p>
          <button
            className="recommendation-close"
            type="button"
            onClick={() => navigate("/")}
          >
            Back to Home
          </button>
        </div>
      ) : pageError && !hasRecommendations && !hasSnapshot ? (
        <div className="recommendation-state">
          <p className="recommendation-error">{pageError}</p>
          <button
            className="recommendation-close"
            type="button"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      ) : isGenerating || (shouldAutoGenerate && !autoGenerateAttemptedRef.current) ? (
        <div className="recommendation-state">
          <div className="recommendation-spinner" aria-hidden="true" />
          <p>Generating recommendations...</p>
          <small>This may take up to 30 seconds.</small>
        </div>
      ) : !hasRecommendations ? (
  <>
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
  </>
) : (
        <>
          <div className="recommendation-container">
            <section className="recommendation-intro">
              <h2>Picks for your group</h2>
              <p className="recommendation-intro-sub">
                Selected: {selectedPlaceIds.length}/{effectiveMax} places
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
                  !isSelected && selectedPlaceIds.length >= effectiveMax;

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
      {/* Reminder Popup */}
      {showReminderPopup && (
                <ReminderPopup
                    isHost={isHost}
                    onClose={() => {
                        setShowReminderPopup(false);
                    }}
                />
            )}
    </main>
  );
}

export default RecommendationPage;
