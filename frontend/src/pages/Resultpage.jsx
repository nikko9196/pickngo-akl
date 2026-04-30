import '@fontsource/suez-one';
import '@fontsource/inter';
import '@fontsource/inter/700.css';
import confetti from 'canvas-confetti';
import { useEffect, useState } from 'react';
import { useLocation } from "react-router-dom";
import './ResultPage.css';

const quote = "\"People who love to eat are always the best people.\" — Julia Child";

export default function ResultPage() {

    const location = useLocation();
    const { votes, result } = location.state;

    console.log("location.state:", location.state);

    const restaurant = {
        name: result,
        address: "123 Queen Street, Auckland CBD, Auckland 1010",
        type: "Chinese • Asian Fusion • Dim Sum",
        photo: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400",
        votes: votes,
    };

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

    return (
        <div className="result-page">

            <p className="result-title">Final Pick!</p>

            <div className="result-main">

                {/* Left: Card + Rating */}
                <div className="result-left">
                    <div className="result-card">
                        <p className="result-restaurant-name">{restaurant.name}</p>
                        <p className="result-restaurant-type">{restaurant.type}</p>
                        <p className="result-restaurant-address">📍 {restaurant.address}</p>

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
                </div>

                {/* Right: Photo */}
                <div className="result-photo-container">
                    <img src={restaurant.photo} alt={restaurant.name} className="result-photo" />
                    <div className="result-photo-overlay" />
                </div>

            </div>

        </div>
    );
}
