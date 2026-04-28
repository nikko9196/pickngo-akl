import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  generateRecommendations,
  getRecommendations,
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

// Toggle between mock and real API during development.
// Set VITE_USE_MOCK_RECOMMENDATIONS=false in .env when Annie's backend is ready.
const USE_MOCK =
  import.meta.env.VITE_USE_MOCK_RECOMMENDATIONS !== "false";

const AUCKLAND_CBD = { lat: -36.8485, lng: 174.7633 };

function RecommendationPage() {
  const navigate = useNavigate();
  const { sessionCode } = useParams();
  const { isAuthenticated, isAuthReady, token } = useAuth();

  const [session, setSession] = useState(null);
  const [items, setItems] = useState([]);
  const [selectedPlaceIds, setSelectedPlaceIds] = useState([]);
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

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (!isAuthenticated || !token) {
      navigate("/auth");
      return;
    }

    let ignore = false;

    async function hydratePage() {
      setIsLoading(true);
      setPageError("");

      try {
        const sessionResponse = await getSessionByCode(token, sessionCode);

        if (ignore) {
          return;
        }

        setSession(sessionResponse.session);

        try {
          const recommendationsResponse = USE_MOCK
            ? await mockGetRecommendations()
            : await getRecommendations(token, sessionResponse.session.id);

          if (ignore) {
            return;
          }

          setItems(recommendationsResponse.items || []);
        } catch {
          // No recommendations yet is a valid state, not an error
          if (!ignore) {
            setItems([]);
          }
        }
      } catch (error) {
        if (!ignore) {
          setPageError(error.message);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void hydratePage();

    return () => {
      ignore = true;
    };
  }, [isAuthReady, isAuthenticated, token, sessionCode, navigate]);

  async function handleGenerate() {
    setIsGenerating(true);
    setPageError("");

    try {
      const centerLocation = await getCenterLocation();
      const response = USE_MOCK
        ? await mockGenerateRecommendations()
        : await generateRecommendations(token, session.id, {
            centerLocation,
            radius: 10,
          });

      setItems(response.items || []);
    } catch (error) {
      setPageError(error.message);
    } finally {
      setIsGenerating(false);
    }
  }

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
      // TODO: Call selections API when it is ready
      // await submitSelections(token, session.id, { selectedPlaceIds });

      // Placeholder until selections API is ready
      console.log("Submitting selections:", selectedPlaceIds);

      // Navigate to wheel page (Paige's work, may not exist yet)
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
      ) : pageError && !hasRecommendations ? (
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
            <p className="recommendation-intro-sub">No recommendations yet.</p>
          </section>
          <div className="recommendation-state">
            {isHost ? (
              <>
                <p>Generate restaurant recommendations for your group.</p>
                <button
                  className="recommendation-generate"
                  type="button"
                  onClick={handleGenerate}
                >
                  Generate Recommendations
                </button>
              </>
            ) : (
              <p>Waiting for the host to generate recommendations...</p>
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

async function getCenterLocation() {
  if (!navigator.geolocation) {
    return AUCKLAND_CBD;
  }

  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 5000,
        maximumAge: 60000,
      });
    });

    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
  } catch {
    return AUCKLAND_CBD;
  }
}

export default RecommendationPage;
