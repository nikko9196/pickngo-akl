import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { createSession } from "../api/sessions";
import aucklandSkyBackground from "../assets/background - auckland - sky transparent 1.png";
import logoPointer from "../assets/Polygon 1.svg";
import { useAuth } from "../context/useAuth";
import "./RoomPage.css";

const DEFAULT_MAP_CENTER = { lat: -36.8485, lng: 174.7633 };
const DEFAULT_LOCATION_RADIUS_METERS = 3000;
let googleMapsLoadPromise;

function loadGoogleMaps() {
    if (window.google?.maps) {
        return Promise.resolve(window.google.maps);
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
        return Promise.reject(new Error("Google Maps API key is missing."));
    }

    if (!googleMapsLoadPromise) {
        googleMapsLoadPromise = new Promise((resolve, reject) => {
            const existingScript = document.querySelector("script[data-google-maps-script]");

            if (existingScript) {
                existingScript.addEventListener("load", () => resolve(window.google.maps), { once: true });
                existingScript.addEventListener("error", () => reject(new Error("Failed to load Google Maps.")), {
                    once: true,
                });
                return;
            }

            const script = document.createElement("script");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
            script.async = true;
            script.defer = true;
            script.dataset.googleMapsScript = "true";
            script.onload = () => resolve(window.google.maps);
            script.onerror = () => reject(new Error("Failed to load Google Maps."));
            document.head.appendChild(script);
        });
    }

    return googleMapsLoadPromise;
}

function formatLocationLabel(position) {
    return `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`;
}

function CreateRoomPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, isAuthReady, token } = useAuth();
    const [maxParticipantsInput, setMaxParticipantsInput] = useState("4");
    const [maxSelectionsPerUserInput, setMaxSelectionsPerUserInput] = useState("3");
    const [radiusMetersInput, setRadiusMetersInput] = useState(String(DEFAULT_LOCATION_RADIUS_METERS));
    const [roomDisplayName, setRoomDisplayName] = useState("");
    const [roomLocation, setRoomLocation] = useState(null);
    const [draftMapLocation, setDraftMapLocation] = useState(DEFAULT_MAP_CENTER);
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [mapStatusMessage, setMapStatusMessage] = useState("");
    const [statusMessage, setStatusMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const mapElementRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);

    useEffect(() => {
        if (isAuthReady && !isAuthenticated) {
            navigate("/auth", {
                replace: true,
                state: { redirectTo: location.pathname },
            });
        }
    }, [isAuthReady, isAuthenticated, location.pathname, navigate]);

    useEffect(() => {
        if (!isMapModalOpen) {
            return undefined;
        }

        let ignore = false;

        loadGoogleMaps()
            .then((maps) => {
                if (ignore || !mapElementRef.current) {
                    return;
                }

                const center = roomLocation
                    ? { lat: roomLocation.lat, lng: roomLocation.lng }
                    : DEFAULT_MAP_CENTER;

                const map = new maps.Map(mapElementRef.current, {
                    center,
                    zoom: 14,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                });
                const marker = new maps.Marker({
                    position: center,
                    map,
                });

                mapRef.current = map;
                markerRef.current = marker;
                setDraftMapLocation(center);

                map.addListener("click", (event) => {
                    const nextLocation = {
                        lat: event.latLng.lat(),
                        lng: event.latLng.lng(),
                    };

                    setDraftMapLocation(nextLocation);
                    marker.setPosition(nextLocation);
                    map.panTo(nextLocation);
                });
            })
            .catch((error) => {
                if (!ignore) {
                    setMapStatusMessage(error.message);
                }
            });

        return () => {
            ignore = true;
        };
    }, [isMapModalOpen, roomLocation]);

    async function handleSubmit(event) {
        event.preventDefault();
        setErrorMessage("");
        setStatusMessage("");
        setIsSubmitting(true);

        try {
            if (!roomLocation) {
                throw new Error("Please choose a room location.");
            }

            const maxParticipants = Number(maxParticipantsInput);
            const maxSelectionsPerUser = Number(maxSelectionsPerUserInput);
            const { session } = await createSession(token, {
                maxParticipants,
                maxSelectionsPerUser,
                roomDisplayName: roomDisplayName.trim(),
                location: roomLocation,
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

    function handleSelectionLimitChange(event) {
        const digitsOnly = event.target.value.replace(/\D/g, "");

        if (!digitsOnly) {
            setMaxSelectionsPerUserInput("");
            return;
        }

        const normalizedValue = String(Number(digitsOnly));
        setMaxSelectionsPerUserInput(normalizedValue);
    }

    function handleSelectionLimitBlur() {
        const normalizedValue = Number(maxSelectionsPerUserInput);

        if (!Number.isInteger(normalizedValue) || normalizedValue < 1) {
            setMaxSelectionsPerUserInput("1");
            return;
        }

        if (normalizedValue > 10) {
            setMaxSelectionsPerUserInput("10");
            return;
        }

        setMaxSelectionsPerUserInput(String(normalizedValue));
    }

    function handleRadiusChange(event) {
        const digitsOnly = event.target.value.replace(/\D/g, "");

        if (!digitsOnly) {
            setRadiusMetersInput("");
            return;
        }

        const normalizedValue = String(Number(digitsOnly));
        setRadiusMetersInput(normalizedValue);
    }

    function handleRadiusBlur() {
        const normalizedValue = Number(radiusMetersInput);

        if (!Number.isInteger(normalizedValue) || normalizedValue < 100) {
            setRadiusMetersInput("100");
            return;
        }

        if (normalizedValue > 50000) {
            setRadiusMetersInput("50000");
            return;
        }

        setRadiusMetersInput(String(normalizedValue));
    }

    function getRadiusMeters() {
        const radiusMeters = Number(radiusMetersInput);

        if (!Number.isInteger(radiusMeters) || radiusMeters < 100 || radiusMeters > 50000) {
            return DEFAULT_LOCATION_RADIUS_METERS;
        }

        return radiusMeters;
    }

    function handleUseCurrentLocation() {
        setErrorMessage("");
        setStatusMessage("");
        setMapStatusMessage("");

        if (!navigator.geolocation) {
            setErrorMessage("Current location is not supported by this browser.");
            return;
        }

        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const nextPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };
                setRoomLocation({
                    source: "current",
                    label: "Current location",
                    ...nextPosition,
                    radiusMeters: getRadiusMeters(),
                });
                setDraftMapLocation(nextPosition);
                setIsLocating(false);
            },
            () => {
                setErrorMessage("Unable to access current location. Please allow location access or pick on map.");
                setIsLocating(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
            }
        );
    }

    function openMapPicker() {
        setMapStatusMessage("");
        setDraftMapLocation(
            roomLocation ? { lat: roomLocation.lat, lng: roomLocation.lng } : DEFAULT_MAP_CENTER
        );
        setIsMapModalOpen(true);
    }

    function handleConfirmMapLocation() {
        setRoomLocation({
            source: "map",
            label: "Selected on map",
            lat: draftMapLocation.lat,
            lng: draftMapLocation.lng,
            radiusMeters: getRadiusMeters(),
        });
        setIsMapModalOpen(false);
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

                            <label>
                                <span>Selections per user later</span>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={maxSelectionsPerUserInput}
                                    onChange={handleSelectionLimitChange}
                                    onBlur={handleSelectionLimitBlur}
                                />
                                <small className="room-field-hint">
                                    How many recommended restaurants each person can shortlist later.
                                </small>
                            </label>

                            <div className="room-location-field">
                                <span>Room location</span>
                                <label className="room-radius-field">
                                    <span>Search radius</span>
                                    <input
                                        type="number"
                                        min="100"
                                        max="50000"
                                        step="100"
                                        value={radiusMetersInput}
                                        onChange={handleRadiusChange}
                                        onBlur={handleRadiusBlur}
                                    />
                                </label>
                                <div className="room-location-actions">
                                    <button
                                        className="room-location-button"
                                        type="button"
                                        onClick={handleUseCurrentLocation}
                                        disabled={isLocating}
                                    >
                                        {isLocating ? "Locating..." : "Use current location"}
                                    </button>
                                    <button className="room-location-button secondary" type="button" onClick={openMapPicker}>
                                        Pick on map
                                    </button>
                                </div>
                                <p className="room-location-summary">
                                    {roomLocation
                                        ? `${roomLocation.label}: ${formatLocationLabel(roomLocation)}, ${roomLocation.radiusMeters}m radius`
                                        : "No location selected"}
                                </p>
                            </div>

                            <button className="cta-button auth-submit" type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Creating..." : "Confirm"}
                            </button>
                        </form>

                        {statusMessage ? <p className="auth-status success">{statusMessage}</p> : null}
                        {errorMessage ? <p className="auth-status error">{errorMessage}</p> : null}
                    </aside>
                </section>
            </section>

            {isMapModalOpen ? (
                <div className="room-map-backdrop" role="presentation" onClick={() => setIsMapModalOpen(false)}>
                    <section
                        className="room-map-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Pick room location"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="room-map-header">
                            <div>
                                <span>Room location</span>
                                <h2>Pick on map</h2>
                            </div>
                            <button className="room-map-close" type="button" onClick={() => setIsMapModalOpen(false)}>
                                Close
                            </button>
                        </div>
                        <div className="room-map-canvas" ref={mapElementRef} />
                        {mapStatusMessage ? <p className="auth-status error">{mapStatusMessage}</p> : null}
                        <p className="room-location-summary">Selected: {formatLocationLabel(draftMapLocation)}</p>
                        <div className="room-map-actions">
                            <button className="room-location-button secondary" type="button" onClick={() => setIsMapModalOpen(false)}>
                                Cancel
                            </button>
                            <button className="room-location-button" type="button" onClick={handleConfirmMapLocation}>
                                Use this location
                            </button>
                        </div>
                    </section>
                </div>
            ) : null}
        </main>
    );
}

export default CreateRoomPage;
