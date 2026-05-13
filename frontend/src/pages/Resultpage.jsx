import '@fontsource/suez-one';
import '@fontsource/inter';
import '@fontsource/inter/700.css';
import confetti from 'canvas-confetti';
import { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import './ResultPage.css';
import { getFinalWheelResult, sendRating } from "../api/userselections";
import { useAuth } from "../context/useAuth";
import { getSessionByCode } from "../api/sessions";
import { useParams } from "react-router-dom";
import { getCurrentUser } from "../api/auth";
import Navbar from "../components/Navbar";
import RoomDeletedModal from "../components/RoomDeletedModal";

const quote = "\"People who love to eat are always the best people.\" — Julia Child";

export default function ResultPage() {
    const navigate = useNavigate();
    const { sessionCode } = useParams();
    const { token } = useAuth();
    const [currentUserId, setCurrentUserId] = useState(null);

    const [restaurantData, setRestaurantData] = useState(null);
    const [votesData, setVotesData] = useState(null);
    const [sessionId, setSessionId] = useState(null);
    const [isRoomDeleted, setIsRoomDeleted] = useState(false);

    const handleSendRating = async (score) => {
        if (!token || !sessionId || rated) return;
    
        try {
            await sendRating(token, sessionId, score);
        } catch (err) {
            console.error("Failed to send rating:", err);
        }
    };
    
    // fetch current user
    useEffect(() => {
        const fetchMe = async () => {
            try {
                const res = await getCurrentUser(token);
                setCurrentUserId(res.user.id);
            } catch (err) {
                console.error("Failed to fetch current user:", err);
            }
        };
    
        if (token) {
            fetchMe();
        }
    }, [token]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { session: sessionInfo } = await getSessionByCode(token, sessionCode);
                setSessionId(sessionInfo.id);

                // restore final result if user rejoined / reload
                const { session } = await getFinalWheelResult(token, sessionInfo.id);
    
                const { name, address, cuisine, rating, priceLevel, photos } = session.finalWheelResult;
    
                const userRatingObj = session.resultRatingSummary?.ratings?.find(
                    (r) => r.userId === currentUserId
                );
                
                const userRating = userRatingObj?.score || null;

                setRestaurantData({
                    name,
                    address,
                    cuisine: cuisine?.join(" • ") || "Unknown",
                    rating,
                    priceLevel,
                    photo: photos?.[0] || "/fallback.jpg",
                    userRating,
                });
    
                setVotesData(session.voteSummary);
    
            } catch (err) {
                if (err.status === 404) {
                    setIsRoomDeleted(true);
                    return;
                }
                console.error("Failed to fetch:", err);
            }
        };
    
        if (token && sessionCode && currentUserId) fetchData();
    }, [token, sessionCode, currentUserId]);

    useEffect(() => {
        if (!token || !sessionCode) {
            return undefined;
        }

        let ignore = false;

        async function checkRoomExists() {
            try {
                await getSessionByCode(token, sessionCode);
            } catch (err) {
                if (!ignore && err.status === 404) {
                    setIsRoomDeleted(true);
                }
            }
        }

        const intervalId = window.setInterval(checkRoomExists, 3000);

        return () => {
            ignore = true;
            window.clearInterval(intervalId);
        };
    }, [sessionCode, token]);

    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [rated, setRated] = useState(false);

    useEffect(() => {
        if (restaurantData?.userRating) {
            setRating(restaurantData.userRating);
            setRated(true); // lock the UI
        }
    }, [restaurantData]);

    useEffect(() => {
        confetti({
            particleCount: 200,
            spread: 120,
            origin: { y: 0.4 },
        });
    }, []);


    if (isRoomDeleted) return <RoomDeletedModal />;
    if (!restaurantData) return <p>Loading...</p>; // add this line here
    return (
        <main className="final-page-shell">
        <Navbar />
        <div className="result-page">

            <p className="result-title">Final Pick!</p>

            <div className="result-main">

                {/* Left: Card + Rating */}
                <div className="result-left">
                    <div className="result-card">
                        <p className="result-restaurant-name">{restaurantData.name}</p>
                        <p className="result-restaurant-type">{restaurantData.cuisine} • {"$".repeat(restaurantData.priceLevel)} • ⭐ {restaurantData.rating}</p>
                        <p className="result-restaurant-address">📍 {restaurantData.address}</p>

                        {votesData && (votesData.acceptCount > 0 || votesData.respinCount > 0) && (
                            <div className="result-vote-row">
                                <div className="result-vote-box">
                                    <p className="result-vote-count">{votesData.acceptCount}</p>
                                    <p className="result-vote-label">👍 Happy</p>
                                </div>

                                <div className="result-vote-box">
                                    <p className="result-vote-count">{votesData.respinCount}</p>
                                    <p className="result-vote-label">🔄 Respin</p>
                                </div>
                            </div>
                        )}

                        <p className="result-quote">{quote}</p>
                    </div>

                    <div className="result-rating-container">
                        <p className="result-rating-title">
                            {rated ? `Thanks for rating us !` : "How was your experience?"}
                        </p>
                        <div className="result-stars">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <span
                                    key={star}
                                    onClick={!rated ? async () => {
                                        setRating(star);
                                        setRated(true);
                                        await handleSendRating(star); // send immediately
                                    } : undefined}
                                    style={{
                                        fontSize: "30px",
                                        cursor: rated ? "default" : "pointer",
                                        color: star <= (rated ? rating : hoverRating || rating) ? "#F27533" : "#ddd",
                                        transition: "color 0.2s ease",
                                    }}
                                    onMouseEnter={() => !rated && setHoverRating(star)}
                                    onMouseLeave={() => !rated && setHoverRating(0)}
                                >
                                    ★
                                </span>
                            ))}
                        </div>
                    </div>
                    {/* Return to Home */}
                    <div className="result-home-wrapper">
                        <button
                            className="result-home-button"
                            onClick={() => navigate('/')}
                        >
                            Return to Home
                        </button>
                    </div>
                </div>

                {/* Right: Photo */}
                <div className="result-photo-container">
                    <img src={restaurantData.photo} alt={restaurantData.name} className="result-photo" />
                    <div className="result-photo-overlay" />
                </div>

            </div>

        </div>
        </main>
    );
}
