import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    deleteSession,
    getMySessions,
    updateSession,
} from "../api/sessions";
import foodPatternBackground from "../assets/background - pattern - food 1.png";
import Navbar from "../components/Navbar";
import taglineImage from "../assets/Tagline 1.png";
import { useAuth } from "../context/useAuth";
import "./HomePage.css";

const SELECTION_LIMIT_LOCKED_STATUSES = ["selecting", "spinning", "voting", "completed"];

function isParticipantLimitLocked(room) {
    return room?.status !== "waiting";
}

function isSelectionLimitLocked(room) {
    return SELECTION_LIMIT_LOCKED_STATUSES.includes(room?.status);
}

function HomePage() {
    const navigate = useNavigate();
    const accountMenuRef = useRef(null);
    const [rooms, setRooms] = useState([]);
    const [roomDrafts, setRoomDrafts] = useState({});
    const [roomMessage, setRoomMessage] = useState("");
    const [roomError, setRoomError] = useState("");
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isRoomsLoading, setIsRoomsLoading] = useState(false);
    const [activeRoomId, setActiveRoomId] = useState("");
    const [roomPendingDelete, setRoomPendingDelete] = useState(null);
    const [brokenAccountAvatarUrl, setBrokenAccountAvatarUrl] = useState("");
    const { isAuthenticated, logout, token, user } = useAuth();

    useEffect(() => {
        if (!isAuthenticated || !token) {
            setRooms([]);
            setRoomDrafts({});
            return;
        }

        let ignore = false;

        async function hydrateRooms() {
            setIsRoomsLoading(true);

            try {
                const { sessions } = await getMySessions(token);

                if (ignore) {
                    return;
                }

                setRooms(sessions);
                setRoomDrafts(
                    sessions.reduce((drafts, room) => {
                        drafts[room.id] = {
                            maxParticipants: String(room.maxParticipants),
                            maxSelectionsPerUser: String(room.maxSelectionsPerUser ?? 3),
                        };
                        return drafts;
                    }, {})
                );
            } catch (error) {
                if (!ignore) {
                    setRoomError(error.message);
                }
            } finally {
                if (!ignore) {
                    setIsRoomsLoading(false);
                }
            }
        }

        void hydrateRooms();

        return () => {
            ignore = true;
        };
    }, [isAuthenticated, token]);

    useEffect(() => {
        if (!isMenuOpen) {
            return;
        }

        function handleDocumentPointerDown(event) {
            if (accountMenuRef.current?.contains(event.target)) {
                return;
            }

            setIsMenuOpen(false);
        }

        document.addEventListener("pointerdown", handleDocumentPointerDown);

        return () => {
            document.removeEventListener("pointerdown", handleDocumentPointerDown);
        };
    }, [isMenuOpen]);

    const welcomeName = user?.displayName || user?.email || "Friend";
    const avatarLabel = welcomeName.trim().charAt(0).toUpperCase() || "U";
    const showAccountAvatar = Boolean(
        user?.avatarUrl && user.avatarUrl !== brokenAccountAvatarUrl
    );
    const roomsById = useMemo(
        () =>
            rooms.reduce((lookup, room) => {
                lookup[room.id] = room;
                return lookup;
            }, {}),
        [rooms]
    );

    function handleRoomDraftChange(roomId, field, value) {
        setRoomDrafts((current) => ({
            ...current,
            [roomId]: {
                maxParticipants: current[roomId]?.maxParticipants ?? "",
                maxSelectionsPerUser: current[roomId]?.maxSelectionsPerUser ?? "",
                [field]: value,
            },
        }));
    }

    async function handleRoomUpdate(roomId) {
        setRoomError("");
        setRoomMessage("");
        setActiveRoomId(roomId);

        try {
            const room = roomsById[roomId];
            const participantLimitLocked = isParticipantLimitLocked(room);
            const selectionLimitLocked = isSelectionLimitLocked(room);
            const roomDraft = roomDrafts[roomId] || {};
            const { session } = await updateSession(token, roomId, {
                maxParticipants: participantLimitLocked
                    ? Number(room?.maxParticipants ?? 2)
                    : Number(roomDraft.maxParticipants),
                maxSelectionsPerUser: selectionLimitLocked
                    ? Number(room?.maxSelectionsPerUser ?? 3)
                    : Number(roomDraft.maxSelectionsPerUser),
            });
            setRooms((current) => current.map((room) => (room.id === roomId ? session : room)));
            setRoomDrafts((current) => ({
                ...current,
                [roomId]: {
                    maxParticipants: String(session.maxParticipants),
                    maxSelectionsPerUser: String(session.maxSelectionsPerUser ?? 3),
                },
            }));
            setRoomMessage(`Room ${session.sessionCode} updated.`);
        } catch (error) {
            setRoomError(error.message);
        } finally {
            setActiveRoomId("");
        }
    }

    async function handleRoomDelete(roomId) {
        const room = roomsById[roomId];

        if (!room) {
            return;
        }

        setRoomError("");
        setRoomMessage("");
        setActiveRoomId(roomId);

        try {
            await deleteSession(token, roomId);
            setRooms((current) => current.filter((item) => item.id !== roomId));
            setRoomMessage(`Room ${room.sessionCode} deleted.`);
        } catch (error) {
            setRoomError(error.message);
        } finally {
            setActiveRoomId("");
        }
    }

    function requestRoomDelete(roomId) {
        const room = roomsById[roomId];

        if (!room) {
            return;
        }

        setRoomPendingDelete(room);
    }

    function getRoomOpenPath(room) {
        switch (room.status) {
            case "questioning":
                return `/sessions/${room.sessionCode}/question`;
            case "generating":
                return `/sessions/${room.sessionCode}/recommendation`;
            case "selecting":
                return room.currentUserReady
                    ? `/sessions/${room.sessionCode}/wheel`
                    : `/sessions/${room.sessionCode}/recommendation`;
            case "spinning":
            case "voting":
                return `/sessions/${room.sessionCode}/wheel`;
            case "completed":
                return `/sessions/${room.sessionCode}/result`;
            case "waiting":
            default:
                return `/sessions/${room.sessionCode}`;
        }
    }

    return (
        <main className="landing-shell">
            <section className="landing-page">
                <div
                    className="landing-pattern"
                    aria-hidden="true"
                    style={{ "--landing-background-image": `url("${foodPatternBackground}")` }}
                />
                <Navbar />

                {isAuthenticated ? (
                    <div className="account-menu landing-account-menu" ref={accountMenuRef}>
                        <button
                            className="account-pill account-pill-trigger landing-account-trigger"
                            type="button"
                            onClick={() => setIsMenuOpen((current) => !current)}
                        >
                            {showAccountAvatar ? (
                                <img
                                    className="account-avatar"
                                    src={user.avatarUrl}
                                    alt={welcomeName}
                                    referrerPolicy="no-referrer"
                                    onError={() => setBrokenAccountAvatarUrl(user.avatarUrl)}
                                />
                            ) : (
                                <div className="account-avatar account-avatar-fallback" aria-hidden="true">
                                    {avatarLabel}
                                </div>
                            )}
                            <span className="landing-account-name">{welcomeName}</span>
                        </button>

                        {isMenuOpen ? (
                            <section className="account-dropdown landing-account-dropdown">
                                <div className="account-dropdown-header">
                                    <strong>My rooms</strong>
                                    <span>{rooms.length} total</span>
                                </div>

                                {isRoomsLoading ? <p className="account-dropdown-state">Loading rooms...</p> : null}
                                {roomMessage ? <p className="auth-status success">{roomMessage}</p> : null}
                                {roomError ? <p className="auth-status error">{roomError}</p> : null}

                                {!isRoomsLoading && rooms.length === 0 ? (
                                    <p className="account-dropdown-state">You have not joined any rooms yet.</p>
                                ) : null}

                                <div className="room-list">
                                    {rooms.map((room) => {
                                        const isHost = room.currentUserRole === "host";
                                        const isBusy = activeRoomId === room.id;
                                        const participantLimitLocked = isParticipantLimitLocked(room);
                                        const selectionLimitLocked = isSelectionLimitLocked(room);

                                        return (
                                            <article className="room-card" key={room.id}>
                                                <div className="room-card-head">
                                                    <strong>{room.sessionCode}</strong>
                                                    <span>{isHost ? "Host" : "Member"}</span>
                                                </div>
                                                <p>
                                                    {room.participantCount}/{room.maxParticipants} participants
                                                </p>
                                                <p>Selection limit: {room.maxSelectionsPerUser ?? 3} per user</p>
                                                {isHost ? (
                                                    <div className="room-card-actions">
                                                        <label className="room-card-field">
                                                            <span>Max participants</span>
                                                            <input
                                                                type="number"
                                                                min="2"
                                                                max="50"
                                                                disabled={participantLimitLocked}
                                                                value={roomDrafts[room.id]?.maxParticipants ?? String(room.maxParticipants)}
                                                                onChange={(event) =>
                                                                    handleRoomDraftChange(room.id, "maxParticipants", event.target.value)
                                                                }
                                                            />
                                                            {participantLimitLocked ? (
                                                                <small className="room-card-field-note">
                                                                    Locked after room starts.
                                                                </small>
                                                            ) : null}
                                                        </label>
                                                        <label className="room-card-field">
                                                            <span>Selections per user</span>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                max="10"
                                                                disabled={selectionLimitLocked}
                                                                value={
                                                                    roomDrafts[room.id]?.maxSelectionsPerUser ??
                                                                    String(room.maxSelectionsPerUser ?? 3)
                                                                }
                                                                onChange={(event) =>
                                                                    handleRoomDraftChange(
                                                                        room.id,
                                                                        "maxSelectionsPerUser",
                                                                        event.target.value
                                                                    )
                                                                }
                                                            />
                                                            {selectionLimitLocked ? (
                                                                <small className="room-card-field-note">
                                                                    Locked after selection starts.
                                                                </small>
                                                            ) : null}
                                                        </label>
                                                        <button type="button" onClick={() => handleRoomUpdate(room.id)} disabled={isBusy}>
                                                            Save
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => navigate(getRoomOpenPath(room), { state: { inviteSession: room } })}
                                                        >
                                                            Open
                                                        </button>
                                                        <button type="button" className="danger" onClick={() => requestRoomDelete(room.id)} disabled={isBusy}>
                                                            Delete
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="room-card-member-actions">
                                                        <p className="room-card-readonly">Members can view rooms here, but only hosts can edit them.</p>
                                                        <button
                                                            type="button"
                                                            onClick={() => navigate(getRoomOpenPath(room), { state: { inviteSession: room } })}
                                                        >
                                                            Open room
                                                        </button>
                                                    </div>
                                                )}
                                            </article>
                                        );
                                    })}
                                </div>

                                <button className="sign-in-link account-signout" type="button" onClick={logout}>
                                    Sign out
                                </button>
                            </section>
                        ) : null}
                    </div>
                ) : (
                    <button
                        className="sign-in-link landing-sign-in-link"
                        type="button"
                        onClick={() => navigate("/auth")}
                    >
                        Sign in
                    </button>
                )}

                <section className="landing-hero">
                    <div className="hero-copy">
                        <div className="hero-text">
                            <img className="hero-tagline-image" src={taglineImage} alt="Let Fate Pick the Table" />
                            <p>
                                Pick a place to eat together in the most fun way possible.
                            </p>
                        </div>

                        <div className="hero-actions">
                            <button className="cta-button" type="button" onClick={() => navigate("/join")}>
                                Join Room
                            </button>
                            <button
                                className="cta-button secondary"
                                type="button"
                                onClick={() => navigate(isAuthenticated ? "/rooms/create" : "/auth")}
                            >
                                Create Room
                            </button>
                        </div>
                    </div>

                </section>

            </section>

            {roomPendingDelete ? (
                <div className="modal-backdrop" role="presentation" onClick={() => setRoomPendingDelete(null)}>
                    <section
                        className="room-modal room-confirm-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Delete room confirmation"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="room-modal-copy">
                            <span className="hero-tag room-danger-tag">Delete room</span>
                            <h2>Remove {roomPendingDelete.sessionCode}?</h2>
                            <p>
                                This room will disappear from your room list. Members will no longer be
                                able to access it with the current invite link or session code.
                            </p>
                        </div>

                        <div className="room-confirm-details">
                            <strong>{roomPendingDelete.sessionCode}</strong>
                            <span>
                {roomPendingDelete.participantCount}/{roomPendingDelete.maxParticipants} participants
              </span>
                        </div>

                        <div className="room-modal-actions">
                            <button
                                className="cta-button secondary room-modal-button"
                                type="button"
                                onClick={() => setRoomPendingDelete(null)}
                            >
                                Keep room
                            </button>
                            <button
                                className="cta-button room-modal-button room-danger-button"
                                type="button"
                                onClick={async () => {
                                    const roomId = roomPendingDelete.id;
                                    setRoomPendingDelete(null);
                                    await handleRoomDelete(roomId);
                                }}
                            >
                                Delete room
                            </button>
                        </div>
                    </section>
                </div>
            ) : null}
        </main>
    );
}

export default HomePage;
