import '@fontsource/suez-one';
import '@fontsource/inter';
import '@fontsource/inter/700.css';
import confetti from 'canvas-confetti';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from "react-router-dom";
import './ResultPage.css';
import { getFinalWheelResult } from "../api/userselections";
import { useAuth } from "../context/useAuth";
import { getSessionByCode } from "../api/sessions";
import { useParams } from "react-router-dom";

const quote = "\"People who love to eat are always the best people.\" — Julia Child";

export default function ResultPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { votes  } = location.state;
    const { sessionCode } = useParams();
    const { token } = useAuth();

    const [restaurantData, setRestaurantData] = useState(null);

    useEffect(() => {
        const fetchResult = async () => {
            try {
                const { session: sessionInfo } = await getSessionByCode(token, sessionCode);
                const { session } = await getFinalWheelResult(token, sessionInfo.id);
                const { name, address, cuisine, rating, priceLevel, photos } = session.finalWheelResult;
                setRestaurantData({
                    name,
                    address,
                    cuisine: cuisine.join(" • "),
                    rating,
                    priceLevel,
                    photo: photos[0],
                });
            } catch (err) {
                console.error("Failed to fetch final result:", err);
            }
        };

        if (token && sessionCode) fetchResult();
    }, [token, sessionCode]);

    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [rated, setRated] = useState(false);

    useEffect(() => {
        confetti({
            particleCount: 200,
            spread: 120,
            origin: { y: 0.4 },
        });
    }, []);

    if (!restaurantData) return <p>Loading...</p>; // ✅ add this line here
    return (
        <div className="result-page">

            <p className="result-title">Final Pick!</p>

            <div className="result-main">

                {/* Left: Card + Rating */}
                <div className="result-left">
                    <div className="result-card">
                        <p className="result-restaurant-name">{restaurantData.name}</p>
                        <p className="result-restaurant-type">{restaurantData.cuisine} • {"$".repeat(restaurantData.priceLevel)} • ⭐ {restaurantData.rating}</p>
                        <p className="result-restaurant-address">📍 {restaurantData.address}</p>

                        {(votes.yes > 0 || votes.respin > 0) && (
                            <div className="result-vote-row">
                                <div className="result-vote-box">
                                    <p className="result-vote-count">{votes.yes}</p>
                                    <p className="result-vote-label">👍 Happy</p>
                                </div>

                                <div className="result-vote-box">
                                    <p className="result-vote-count">{votes.respin}</p>
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
                                    onClick={!rated ? () => { setRating(star); setRated(true); } : undefined}
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
                    {/* ✅ Return to Home */}
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
    );
}
