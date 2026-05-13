// ============================================================
// IMPORTS
// ============================================================
import '@fontsource/suez-one';
import '@fontsource/inter';
import '@fontsource/inter/700.css';
import { FiUser } from "react-icons/fi";
import { Wheel } from 'react-custom-roulette';
import { useEffect, useState, useRef } from "react";
import cropped_wheel from "../assets/cropped_wheel.png"
import spinner from "../assets/spinner.png"
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import './Wheelpage.css';
import { getSessionByCode } from "../api/sessions";
import { buildWheelApi, spinWheel, getHost, submitVoteApi, ifRespin, reloadWheel,
sendReady, sendRemind, collectReadyStatus, getWheelState, getRemind} from "../api/userselections";
import { useAuth } from "../context/useAuth";
import { getCurrentUser } from "../api/auth";
import foodPatternBackground from "../assets/background - pattern - food 1.png";
import Navbar from "../components/Navbar";
import loadingIllustration from "../assets/loading 1.png";
import ReminderPopup from "../components/ReminderPopup";
import { useReminderPopup } from "../hooks/useReminderPopup";

// ============================================================
// CONSTANTS
// ============================================================

/** Duration of the voting countdown timer in seconds. */
const DURATION = 15 // seconds - duration for voting

/**
 * Ordered list of background colors for wheel segments.
 * Colors cycle via modulo if there are more segments than colors.
 */
const wheelcolors = [
    '#2D4A8A', // deep blue
    '#1B8A5A', // emerald
    '#D64045', // red
    '#7B2D8B', // purple
    '#E8A838', // amber
    '#E85D8A', // pink
    '#3D7A3D', // forest green
    '#C45C1A', // burnt orange
    '#1A7A9A', // teal
    '#8A2D2D', // burgundy
    '#2D8A7A', // seafoam
    '#F45B26', // orange
    '#9A6A2D', // caramel
    '#5A2D8A', // violet
    '#4A4A9A', // periwinkle
    ];
    
// ============================================================
// COMPONENT
// ============================================================

/**
 * WheelPage — the main game screen for a session.
 *
 * Responsibilities:
 * - Connects to the Socket.IO server using a JWT token for authentication.
 * - Loads and displays the spin wheel with restaurant options for the session.
 * - Handles the full spin lifecycle: spin → animation → result → voting → respin or result page.
 * - Syncs real-time state (spin, votes, ready status, reminders) across all participants via socket events.
 * - Restores UI state for users who rejoin mid-session (mid-spin, mid-vote, completed).
 * - Host-exclusive actions: spin the wheel, resolve votes, send reminders.
 *
 * Socket events emitted:
 *   join_session, build_wheel, spin, vote, ready, send_reminder,
 *   spin_finished, respin, reload_wheel
 *
 * Socket events listened to:
 *   spin, vote_update, respin_update, wheel_built, wheel_reloaded,
 *   ready_update, spin_finished, voting_start_time, reminder_sent
 */
export default function Wheelpage() {

    const navigate = useNavigate();
    const { sessionCode } = useParams();
    const { token } = useAuth();

    /**
     * Socket.IO client instance stored as a ref so it persists across renders
     * without causing re-renders when it changes.
     * Initialized in a useEffect once the token is available.
     */
    const socket = useRef(null); 

    /**
     * Initializes the Socket.IO connection once the JWT token is available.
     * Passes the token in the handshake auth object for server-side JWT verification.
     * Disconnects and cleans up the socket when the component unmounts or token changes.
     */
    useEffect(() => {
        if (!token) return;
        socket.current = io(import.meta.env.VITE_API_BASE_URL, {
            auth: { token }
        });
        return () => socket.current.disconnect();
    }, [token]);

    // ── Wheel State ────────────────────────────────────────────
    /** Controls whether the react-custom-roulette wheel starts spinning. */
    const [mustSpin, setMustSpin] = useState(false);
    /** Index into `data` that the wheel will land on. */
    const [prizeNumber, setPrizeNumber] = useState(0);
    /** The winning wheel item object after the spin completes. Null while spinning or idle. */
    const [result, setResult] = useState(null);
    /** True while the wheel is actively spinning; disables spin button and other controls. */
    const [spinactivate, spinActivate] = useState(false);
    /** Tracks hover state on the spin button for the scale animation. */
    const [hovered, setHovered] = useState(false);
    /** Array of mapped wheel segment objects used by react-custom-roulette. */
    const [data, setData] = useState(null);
    /** MongoDB session ID fetched on load; used for API calls. */
    const [sessionId, setSessionId] = useState(null);
    /** Ref mirror of sessionId; safe to read inside socket callbacks and timeouts. */
    const sessionIdRef = useRef(null); // for socket listeners and timeouts
    /** Whether the current spin is the final deciding spin (no more respins). */
    const [finalSpin, setFinalSpin] = useState(null);

    // ── User State ─────────────────────────────────────────────
    /** Whether the current user has clicked READY. */
    const [getready, setReady] = useState(false);
    /** Whether the current user is the session host. */
    const [isHost, setIsHost] = useState(false); 
    /** Whether all participants are ready (unlocks the spin button for the host). */
    const [spinready, setSpinReady] = useState(false); 
    /** Number of participants who have marked themselves as ready. */
    const [readyCount, setReadyCount] = useState(0);
    /** Total number of participants in the session. */
    const [totalParticipants, setTotalParticipants] = useState(0);
    /** Full participant list with ready status, used for the ready dropdown. */
    const [participants, setParticipants] = useState([]);
    /** The current user's MongoDB userId string. */
    const [currentUserId, setCurrentUserId] = useState(null);

    // ── Vote State ─────────────────────────────────────────────
    /** Whether the current user has already submitted a vote in this round. */
    const [voted, setVoted] = useState(false);
    /** Live vote counts for the current round. */
    const [votes, setVotes] = useState({ yes: 0, respin: 0});
    /** Respin decision after voting: true = respin, false = accept result, null = not decided yet. */
    const [respin, setRespin] = useState(null); // to pass parameters true as respin and false as happy
    /** Seconds remaining in the current vote countdown. */
    const [timeLeft, setTimeLeft] = useState(DURATION);
    /** The result and vote counts from the previous round, shown as "Last Pick" on screen. */
    const [lastResult, setLastResult] = useState(null);
    /** Controls visibility of the voting popup after a spin result is set. */
    const [showVotePopup, setShowVotePopup] = useState(false);
    /** Warning message shown when a user tries to vote twice. */
    const [voteWarning, setVoteWarning] = useState("");

    // ── Refs ───────────────────────────────────────────────────
    /** Ref mirror of `result`; safe to read inside async callbacks. */
    const resultRef = useRef(result); 
    /** Ref mirror of `votes`; safe to read inside async callbacks. */
    const votesRef = useRef(votes);
    /** Ref mirror of `isHost`; safe to read inside socket listeners and timers. */
    const isHostRef = useRef(false); // check if player is the host
    /** Ref mirror of `data`; safe to read inside socket listeners without stale closure. */
    const dataRef = useRef(null);
    /** Ref mirror of `currentUserId`; safe to read inside socket listeners. */
    const currentUserIdRef = useRef(null);
    /** Tracks the spinRoundId of the most recent spin to prevent duplicate state restores. */
    const latestSpinRoundIdRef = useRef(null);
    /** Tracks the current session status ("selecting", "voting", "spinning", "completed"). */
    const sessionStatusRef = useRef(null);
    /**
     * spinRoundId of a voting round that was restored on rejoin.
     * Used to suppress duplicate "spin" socket events for the already-restored round.
     */
    const restoredVotingRoundIdRef = useRef(null);
    /** True if a voting round was restored from server state on rejoin (not triggered by a live spin event). */
    const hasRestoredVotingRef = useRef(false);
    /**
     * Server-authoritative timestamp (Date.now()) of when the current voting round started.
     * Used to sync the countdown timer across all clients, including rejoining users.
     */
    const voteStartTimeRef = useRef(null);
    /**
     * Holds the restored result object for a non-host rejoining mid-vote.
     * The result is not shown immediately — it waits for the "voting_start_time"
     * socket event to arrive first so the countdown timer is synced before display.
     */
    const pendingRestoreResultRef = useRef(null);

    // ── Dropdown State ─────────────────────────────────────────
    /** Controls visibility of the ready status dropdown. */
    const [showReadyDropdown, setShowReadyDropdown] = useState(false);
    /** Controls visibility of the group picks dropdown (mobile). */
    const [showGroupPicks, setShowGroupPicks] = useState(false);

    // ── Reminder State ─────────────────────────────────────────
    /**
     * Reminder popup state managed by the useReminderPopup hook.
     * showReminderPopup: whether to display the reminder popup for this user.
     * remindedUserIds: list of userIds who have been sent a reminder this session.
     */
    const {
        showReminderPopup,
        setShowReminderPopup, 
        remindedUserIds,
        setRemindedUserIds
    } = useReminderPopup(socket, currentUserIdRef);

    /** Active tab on the desktop side panel: 'picks' or 'members'. */
    const [activeTab, setActiveTab] = useState('picks');
    
    /**
     * Transforms raw session wheel items from the API into the format
     * expected by react-custom-roulette and the vote/result UI.
     * @param {Array} items - Raw wheel items from the backend session object.
     * @returns {Array} Mapped wheel segment objects with style, truncated labels, and metadata.
     */
    const mapWheelItems = (items) => {
        if (!Array.isArray(items)) return [];
    
        return items.map((item, i) => ({
            option_truncate: truncate(item.name, 15),
            placeId: item.placeId,
            roomDisplayName: item.roomDisplayName,
            photo: item.photos,
            option: item.name,
            rating: item.rating,
            priceLevel: item.priceLevel,
            address: item.address,
            cuisine: item.cuisine?.join(" • ") ?? "",
            style: {
                backgroundColor: wheelcolors[i % wheelcolors.length],
                textColor: "#ffffff"
            }
        }));
    };

    // ============================================================
    // HANDLERS
    // ============================================================

    /**
     * HOST ONLY — Initiates a spin by calling the backend API to determine the result,
     * then emits a "spin" socket event to trigger the wheel animation on all clients.
     * The backend is the source of truth for which segment is selected.
     */
    const handleSpin = async () => {
        try {
            const response = await spinWheel(token, sessionId);
            const restaurantName = response.session.currentWheelResult.name;
            const ifFinalSpin = response.session?.finalSpin;
            setFinalSpin(ifFinalSpin);
            // find the index in data that matches the backend result
            const newPrize = data.findIndex(item => item.option === restaurantName);
    
            setPrizeNumber(newPrize);
            setResult(null);
            setMustSpin(true);
            spinActivate(true);
            setRespin("");
            setVoted(false);
    
            // notify all users in the session to spin
            socket.current.emit("spin", {
              sessionCode,
              prizeNumber: newPrize,
              placeId: response.session.currentWheelResult.placeId,
              finalSpin: ifFinalSpin,
              sessionId,
              spinRoundId: response.session.spinRoundId,
            });

        } catch (error) {
            console.error("Failed to spin wheel:", error);
        }
    };

    /**
     * Called by react-custom-roulette's onStopSpinning callback when the
     * wheel animation completes on the host's client.
     * HOST ONLY — emits "spin_finished" with the authoritative result so all
     * clients can display the result and start the voting timer.
     * Non-hosts do nothing here; they receive the result via the socket event.
     */
    const handleStop = () => {
        setMustSpin(false);
        setHovered(false);
    
        // only host decides the final result
        if (isHostRef.current) {
    
            const spinResult = data[prizeNumber];
            if (!spinResult) {
                console.error("Invalid spin result");
                return;
            }
    
            // broadcast authoritative result
            socket.current.emit("spin_finished", {
                sessionCode,
                result: spinResult,
                finalSpin,
                sessionId
            });
        }
    };

    /**
     * Submits the current user's vote (accept or respin) to the backend,
     * then emits a "vote" socket event so all clients receive updated vote counts.
     * Re-syncs the voted state from the backend to prevent double-voting.
     * @param {'accept' | 'respin'} choice - The user's vote choice.
     */
    const handleVote = async (choice) => {
        try {
            await submitVoteApi(token, sessionId, choice);
            socket.current.emit("vote", { sessionCode, sessionId });
    
            // re-sync from backend (source of truth)
            const res = await getWheelState(token, sessionId);
            setVoted(hasUserVoted(currentUserIdRef.current, res.session));
    
        } catch (error) {
            console.error("Failed to submit vote:", error);

            // backend duplicate vote warning
            if (
                error.message?.includes("already voted")
            ) {
                setVoteWarning("⚠️ You have already voted.");
            }
        }
    };

    /**
     * Marks the current user as ready, calls the backend to persist the state,
     * and emits a "ready" socket event so all clients receive the updated ready count.
     */
    const handleReady = async () => {
        try {
            setReady(true);
            await sendReady(token, sessionId);
            socket.current.emit("ready", {sessionCode,sessionId});
    
        } catch (err) {
            console.error(err);
        }
    };

    /**
     * Resets all per-round vote state back to defaults.
     * Called at the start of each new spin to clear the previous round's data.
     */
    const resetRoundState = () => {
        setResult(null);
        setVoted(false);
        setRespin(null);
        setVotes({ yes: 0, respin: 0 });
        setTimeLeft(DURATION);
        setVoteWarning(null);
    };
    
    /**
     * Truncates a string to a maximum length, appending "…" if truncated.
     * Used to keep wheel segment labels short enough to fit on the wheel.
     * @param {string} text - The text to truncate.
     * @param {number} maxLength - Maximum character length before truncation.
     * @returns {string} The (possibly truncated) string.
     */
    const truncate = (text, maxLength = 15) => {
        return text.length > maxLength
            ? text.slice(0, maxLength) + "…"
            : text;
    };

    /**
     * HOST ONLY — Sends a reminder to all participants who have not yet marked
     * themselves as ready. Calls the backend to record the reminded user IDs,
     * then emits a "send_reminder" socket event so the reminder popup appears
     * on the screens of the relevant participants.
     */
    const handleSendReminder = async () => {
        try {
            const res = await sendRemind(token, sessionId);
    
            socket.current.emit("send_reminder", {
                sessionCode,
                sessionId
            });
    
            setRemindedUserIds(res.remindedUserIds);
        } catch (err) {
            console.error(err);
        }
    };

    /**
     * Checks whether a given user has already voted in the current round.
     * @param {string} userId - The user's ID to check.
     * @param {Object} session - The session object from the backend.
     * @returns {boolean} True if the user's ID is in the voteSummary.votedUserIds list.
     */
    const hasUserVoted = (userId, session) => {
        return session?.voteSummary?.votedUserIds?.includes(userId);
    };

    // ============================================================
    // EFFECTS
    // ============================================================

    /** Keeps dataRef in sync with the data state for use inside socket callbacks. */
    useEffect(() => { dataRef.current = data; }, [data]);

    /** Keeps sessionIdRef in sync with sessionId for use inside socket callbacks and timers. */
    useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

    /** Keeps currentUserIdRef in sync with currentUserId for use inside socket callbacks. */
    useEffect(() => {
        currentUserIdRef.current = currentUserId;
    }, [currentUserId]);

    /**
     * Fetches the current user's ID once the token is available.
     * Stored in state and ref for use in vote checking and socket callbacks.
     */
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

    /** Prevents loadWheelData from running twice in React StrictMode or concurrent renders. */
    const isLoadingRef = useRef(false); // add with other refs

    /**
     * Main data loading effect. Runs once on mount (when token and sessionCode are available).
     * Responsibilities:
     * 1. Fetches session, participants, wheel items, vote state, and reminder state from the backend.
     * 2. Builds the wheel if the session is in "selecting" status, or reloads existing items.
     * 3. Restores UI state for users rejoining mid-vote or mid-session:
     *    - "voting" status: restores the current result and vote counts; host re-broadcasts spin_finished.
     *    - "completed" status: restores the final result and navigates to the result page.
     * 4. Emits "join_session" so the backend can push current spin state to this socket.
     */
    useEffect(() => {
        async function loadWheelData() {
        if (isLoadingRef.current) return; // prevent duplicate calls
        isLoadingRef.current = true;
        try {
            const { session } = await getSessionByCode(token, sessionCode);
            const id = session.id;
            setSessionId(id);
            const { readySummary } = await collectReadyStatus(token, id);

            setReadyCount(readySummary.readyCount);
            setTotalParticipants(readySummary.totalParticipants);
            setParticipants(readySummary.participants);
            setSpinReady(readySummary.allReady);

            const { user } = await getCurrentUser(token);
            setCurrentUserId(user.id);

            const currentParticipant = readySummary.participants.find(
                p => p.userId === user.id
            );

            if (currentParticipant) {
                setReady(currentParticipant.isReady);
            }
            
            // restore wheel state if user rejoined mid-session
            const wheelState = await getWheelState(token, id);
            const currentResult = wheelState.session?.currentWheelResult;
            const sessionStatus = wheelState.session?.status;
            sessionStatusRef.current = sessionStatus;
            latestSpinRoundIdRef.current =
              wheelState.session?.spinRoundId || null;
            const sessionData = wheelState.session ?? wheelState;
            const wheelItems = sessionData.wheelItems || [];
            const voted = hasUserVoted(user.id, wheelState.session);
            setVoted(voted);

            // restore CURRENT round live vote counts from getWheelState
            const currentVoteSummary = wheelState.session?.voteSummary;
            if (sessionStatus === "voting" && currentVoteSummary) {
                setVotes({
                    yes: currentVoteSummary.acceptCount ?? 0,
                    respin: currentVoteSummary.respinCount ?? 0
                });
            }

            // restore latest voting result if user rejoined mid-session
            const wheelLastRound = await reloadWheel(token, id);
            const lastRoundResult = wheelLastRound.session?.lastWheelResult?.name;
            const lastRoundVoteSummary = wheelLastRound.session?.lastVoteSummary;

            if (lastRoundResult && lastRoundVoteSummary) {
                setLastResult({
                    result: lastRoundResult,
                    votes: {
                        yes: lastRoundVoteSummary.acceptCount ?? 0,
                        respin: lastRoundVoteSummary.respinCount ?? 0
                    }
                });

            }

            // restore Reminder status if user rejoined mid-session
            const reminderRes = await getRemind(token, id);
            const remindedUserIdsRes = reminderRes?.remindedUserIds;
            if (Array.isArray(remindedUserIdsRes) && remindedUserIdsRes.length > 0) {
                setRemindedUserIds(remindedUserIdsRes);
            }

            // Only build wheel if status is selecting
            let finalWheelItems = wheelItems;
            if (sessionStatus === 'selecting') {
                const { session: newBuilt } = await buildWheelApi(token, id);
                finalWheelItems = newBuilt.wheelItems;
                socket.current.emit("build_wheel", { sessionCode });
            }

            const fetchedData = mapWheelItems(finalWheelItems);

            setData(fetchedData);
            dataRef.current = fetchedData;

            // Restore state for a user who rejoined during an active voting round.
            if (sessionStatus === "voting" && currentResult?.placeId) {
                const prize = fetchedData.findIndex(item => item.placeId === currentResult.placeId);
                if (prize >= 0) {
                    setPrizeNumber(prize);
                    setMustSpin(false);
                    spinActivate(false);
            
                    if (isHostRef.current) {
                        // normal voting round — re-broadcast spin_finished to reset timer for everyone
                        socket.current.emit("spin_finished", {
                            sessionCode,
                            result: fetchedData[prize],
                            finalSpin: false, // ✅ always false here — finalSpin goes to "completed" block
                            sessionId: id
                        });
                    } else {
                        // non-host restore path — wait for voting_start_time before setting result
                        // so the countdown timer is synced to the server start time.
                        hasRestoredVotingRef.current = true;
                        restoredVotingRoundIdRef.current = wheelState.session?.spinRoundId || null;
                        pendingRestoreResultRef.current = fetchedData[prize];
                        setShowVotePopup(true);
                    }
                }
            }

            // Restore state for a user who rejoined after the session completed (final spin).
            if (sessionStatus === "completed" && currentResult?.placeId) {
                const prize = fetchedData.findIndex(item => item.placeId === currentResult.placeId);
                if (prize >= 0) {
                    setPrizeNumber(prize);
                    setMustSpin(false);
                    spinActivate(false);
            
                    if (isHostRef.current) {
                        // delay to allow non-host wheel animation to complete first
                        setTimeout(() => {
                            socket.current.emit("spin_finished", {
                                sessionCode,
                                result: fetchedData[prize],
                                finalSpin: true,
                                sessionId: id
                            });
                        }, 2500); // wait for wheel animation to finish
                        setFinalSpin(true);
                        setResult(fetchedData[prize]);
                        setTimeout(() => navigate(`/sessions/${sessionCode}/result`), 3000);
                    } else {
                        // non-host — navigate directly
                        setFinalSpin(true);
                        setResult(fetchedData[prize]);
                        setTimeout(() => navigate(`/sessions/${sessionCode}/result`), 3000);
                    }
                }
            }

            // Re-emit join_session so the backend can push current spin/voting state
            // to this socket if the session is mid-round.
            if (socket.current) {
                socket.current.emit("join_session", { sessionCode });
            }

            isLoadingRef.current = false; // reset on error to allow retry

        } catch (error) {
            console.error("Failed to load wheel data:", error);
            isLoadingRef.current = false; // reset on error to allow retry
        }
    }

    // initial load
    if (token && sessionCode) {
        loadWheelData();
    }
    }, [token, sessionCode]);

    /** Keeps votesRef in sync with votes for use inside async callbacks. */
    useEffect(() => { votesRef.current = votes; }, [votes]);
    /** Keeps resultRef in sync with result for use inside async callbacks. */
    useEffect(() => { resultRef.current = result; }, [result]);
    /** Keeps isHostRef in sync with isHost for use inside socket listeners and timers. */
    useEffect(() => { isHostRef.current = isHost; }, [isHost]);

    /**
     * Checks whether the current user is the host of this session.
     * Runs after sessionId is set. Updates isHost state and the isHostRef.
     */
    useEffect(() => {
        if (!token || !sessionId) return;
    
        const checkHost = async () => {
            try {
                const response = await getHost(token, sessionId);
                if (response.isHost !== undefined) {
                    setIsHost(response.isHost);
                }
            } catch (error) {
                console.error("Failed to check host status:", error);
            }
        };
        checkHost();
    }, [token, sessionId]);

    /**
     * Attaches all Socket.IO event listeners once the socket is initialized.
     * Guarded by socket.current null check since the socket init effect and this
     * effect both depend on [token] and may race each other.
     * Cleans up all listeners on unmount or when dependencies change to prevent duplicates.
     *
     * Listeners:
     * - "spin": starts the wheel animation when the host spins.
     * - "vote_update": re-fetches vote counts from the backend when any user votes.
     * - "respin_update": handles the host's respin/accept decision after voting ends.
     * - "wheel_built": non-hosts use this to load wheel data after the host builds the wheel.
     * - "wheel_reloaded": reloads wheel items after a respin removes the previous result.
     * - "ready_update": updates the ready count and participant list for all users.
     * - "spin_finished": sets the authoritative result and starts the vote timer for all users.
     * - "voting_start_time": syncs the vote countdown timer for users who rejoin mid-vote.
     */
    useEffect(() => {
        if (!token || !sessionCode || !socket.current) return;

        // listen for spin from host
        socket.current.on(
          "spin",
          ({ prizeNumber, placeId, finalSpin, spinRoundId }) => {
            // Suppress duplicate spin events for a round already restored from server state.
            if (
              hasRestoredVotingRef.current &&
              restoredVotingRoundIdRef.current === spinRoundId
            ) {
              return;
            }

            hasRestoredVotingRef.current = false;
            restoredVotingRoundIdRef.current = null;

            latestSpinRoundIdRef.current = spinRoundId;
            sessionStatusRef.current = "spinning";

            // Use prizeNumber if provided; fall back to finding the segment by placeId
            // (e.g. when rejoining and the host's prizeNumber is not available).
            const resolvedPrize =
              prizeNumber !== null && prizeNumber !== undefined
                ? prizeNumber
                : (dataRef.current?.findIndex(
                    (item) => item.placeId === placeId,
                  ) ?? 0);

            setPrizeNumber(resolvedPrize);
            setFinalSpin(finalSpin);
            resetRoundState();

            setMustSpin(true);
            spinActivate(true);
          },
        );

        /** Re-fetches vote counts from the backend when any participant submits a vote. */
        socket.current.on("vote_update", async () => {
            const res = await getWheelState(token, sessionIdRef.current);
        
            const votedNow = hasUserVoted(currentUserIdRef.current, res.session);
            setVoted(votedNow);
        
            setVotes({
                yes: res.session.voteSummary.acceptCount || 0,
                respin: res.session.voteSummary.respinCount || 0
            });
        });

        /**
         * Handles the host's respin/accept decision broadcast after the voting timer expires.
         * - If respin: resets spin state so the host can spin again.
         * - If accepted or final spin: navigates all clients to the result page.
         * Also syncs the last round's result for the "Last Pick" display.
         */
        socket.current.on("respin_update", async ({ isrespin, finalSpin }) => {
            if (isrespin) {
              hasRestoredVotingRef.current = false;
              restoredVotingRoundIdRef.current = null;
              spinActivate(false);
              setMustSpin(false);
            }

            setRespin(isrespin);
        
            try {
        
                // fetch authoritative backend state
                const reload = await reloadWheel(
                    token,
                    sessionIdRef.current
                );
        
                const lastRoundResult =
                    reload.session?.lastWheelResult;
        
                const lastRoundVoteSummary =
                    reload.session?.lastVoteSummary;
        
                // restore latest round result safely
                if (lastRoundResult && lastRoundVoteSummary) {
        
                    const syncedLastResult = {
                        result: lastRoundResult.name,
                        votes: {
                            yes: lastRoundVoteSummary.acceptCount ?? 0,
                            respin: lastRoundVoteSummary.respinCount ?? 0
                        }
                    };
        
                    // update UI state
                    setLastResult(syncedLastResult);
        
                    // keep live vote state synced too
                    setVotes({
                        yes: lastRoundVoteSummary.acceptCount ?? 0,
                        respin: lastRoundVoteSummary.respinCount ?? 0
                    });
        
                    // keep refs synced immediately
                    votesRef.current = syncedLastResult.votes;
                }
        
                // navigate if round ended
                if (!isrespin || finalSpin === true) {
                    setTimeout(() => {
                        navigate(`/sessions/${sessionCode}/result`);
                    }); 
                    return;
                }
        
            } catch (error) {
        
                console.error(
                    "Failed to sync last round result:",
                    error
                );
            }
        });

        /** Non-hosts use this event to load wheel data after the host builds the wheel. */
        socket.current.on("wheel_built", async () => {
            try {
                const { session } = await getSessionByCode(token, sessionCode);

                // use reloadWheel instead of buildWheelApi
                const { session: wheelData } = await reloadWheel(token, session.id);
                const fetchedData = mapWheelItems(wheelData.wheelItems);

                setSessionId(session.id);
                setData(fetchedData);
                setTotalParticipants(session.participants?.length || 0);
                
            } catch (error) {
                console.error("Failed to load wheel on wheel_built event:", error);
            }
        });

        /** Reloads wheel items after a respin removes the previous result from the pool. */
        socket.current.on("wheel_reloaded", async () => {
            try {
                const { session } = await reloadWheel(token, sessionIdRef.current); // use ref
                const fetchedData = mapWheelItems(session.wheelItems);
                setData(fetchedData);
            } catch (error) {
                console.error("Failed to reload wheel:", error);
            }
        });

        /** Updates the ready count and participant list for all users when someone marks ready. */
        socket.current.on("ready_update", ({ readyCount, totalParticipants, allReady, participants }) => {
            setReadyCount(readyCount);
            setTotalParticipants(totalParticipants);
            setSpinReady(allReady);
            setParticipants(participants);
        });
        
        /**
         * Receives the authoritative spin result from the host after the wheel stops.
         * Sets the result for all clients (including the host) and starts the vote timer.
         * For the final spin, non-hosts are navigated to the result page after 3 seconds.
         */
        socket.current.on("spin_finished", ({ result, finalSpin, startTime }) => {

            // listeners sync from host result
            sessionStatusRef.current = finalSpin ? "completed" : "voting";
            
            // Store startTime before setting result so the voting timer useEffect
            // can read it synchronously when it fires.
            if (!finalSpin && startTime) {
                voteStartTimeRef.current = startTime;
            }

            // now set result for everyone including host
            setResult(result);
        
            setFinalSpin(finalSpin);
            setMustSpin(false);
            spinActivate(false);
            setHovered(false);

            // non-host final navigation
            if (finalSpin && !isHostRef.current) {
                setTimeout(() => navigate(`/sessions/${sessionCode}/result`), 3000);
            }
        });

        /**
         * Receives the server-authoritative voting start time for users rejoining mid-vote.
         * Sets the timer ref first, then triggers the pending result display so the
         * countdown is synced before the vote popup appears.
         */
        socket.current.on("voting_start_time", ({ startTime }) => {
            voteStartTimeRef.current = startTime; // set before result triggers the timer
            
            // now safe to trigger the timer useEffect
            if (pendingRestoreResultRef.current) {
                setResult(pendingRestoreResultRef.current);
                pendingRestoreResultRef.current = null;
            }
        });
        
        return () => {
            socket.current.off("spin");
            socket.current.off("vote_update");
            socket.current.off("respin_update");
            socket.current.off("wheel_built"); 
            socket.current.off("wheel_reloaded"); 
            socket.current.off("ready_update");
            socket.current.off("spin_finished");
            socket.current.off("voting_start_time");
        };
    }, [sessionCode, token]);

    /**
     * Voting timer effect. Runs whenever `result` changes.
     *
     * - Shows the vote popup if the user hasn't voted yet.
     * - If this is the final spin, skips the timer and navigates the host to the result page.
     * - Otherwise, calculates the remaining time using the server-authoritative startTime,
     *   starts a countdown interval, and schedules the host's vote resolution timeout.
     * - HOST ONLY: when the timer expires, calls ifRespin() to determine the outcome,
     *   then emits "respin" and optionally "reload_wheel".
     * - Cleans up the interval and timeout on unmount or when result changes.
     */
    useEffect(() => {

        if (!result) return;

        if (!voted) {
            setShowVotePopup(true);
        }

        setTimeLeft(DURATION);

        // if final spin, no need for voting timer
        // AFTER the finalSpin early-return block
        if (finalSpin) {
            spinActivate(false);
            setShowVotePopup(false);
            if (isHostRef.current) {                          
                setTimeout(() => {
                    navigate(`/sessions/${sessionCode}/result`);
                }, 3000);
            }
            return;
        }

        // calculate remaining time based on server's startTime
        const startTime = voteStartTimeRef.current || Date.now();
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(DURATION * 1000 - elapsed, 0);

        // set initial timeLeft accurately from server start time
        setTimeLeft(Math.ceil(remaining / 1000));

        // sync countdown to real elapsed time instead of just decrementing
        const countdown = setInterval(() => {
            const elapsedNow = Date.now() - startTime;
            const remainingNow = Math.max(DURATION * 1000 - elapsedNow, 0);
            const secondsLeft = Math.ceil(remainingNow / 1000);
            setTimeLeft(secondsLeft);
            if (secondsLeft <= 0) {
                clearInterval(countdown);
            }
        }, 500); // poll every 500ms for smoother accuracy

        // Schedule host vote resolution based on actual remaining time, not full DURATION,
        // so rejoining hosts resolve at the correct time rather than restarting the timer.
        const timer = setTimeout(async () => {
            if (!isHostRef.current) return;
            setShowVotePopup(false);
            try {
                const shouldRespin = await ifRespin(token, sessionIdRef.current);
                setRespin(shouldRespin);
                socket.current.emit("respin", {
                    sessionCode,
                    isrespin: shouldRespin,
                    finalSpin,
                    sessionId: sessionIdRef.current
                });
                if (!shouldRespin) {
                    // keep popup visible for 3s so user sees the result before leaving
                    setTimeout(() => {
                        
                        navigate(`/sessions/${sessionCode}/result`);
                    }, 3000);
                }
                if (shouldRespin) {
                    socket.current.emit("reload_wheel", {
                        sessionCode,
                        sessionId: sessionIdRef.current
                    });
                }
            } catch (error) {
                console.error("Vote resolution error:", error.message);
            }
        }, remaining); // uses actual remaining time, not full DURATION

        spinActivate(false);
      
        return () => {
          clearTimeout(timer);
          clearInterval(countdown);
        };
    }, [result]);

    /**
     * Closes the ready dropdown when the user clicks outside of it.
     * Specifically ignores clicks on the dropdown trigger button itself.
     */
    useEffect(() => {
        const handleClickOutside1 = (e) => {
            if (!e.target.closest(".ready-dropdown") &&
                !e.target.closest(".wp-black-button--right")) {
                setShowReadyDropdown(false);
            }
        };
    
        document.addEventListener("click", handleClickOutside1);
        return () => document.removeEventListener("click", handleClickOutside1);
    }, []);

    /**
     * Closes the group picks dropdown when the user clicks outside of it.
     * Specifically ignores clicks on the dropdown trigger button itself.
     */
    useEffect(() => {
        const handleClickOutside2 = (e) => {
            if (!e.target.closest(".picks-dropdown") &&
                !e.target.closest(".wp-black-button--left")) {
                setShowGroupPicks(false);
            }
        };
    
        document.addEventListener("click", handleClickOutside2);
        return () => document.removeEventListener("click", handleClickOutside2);
    }, []);

    /**
     * Checks whether a participant has been sent a reminder this session.
     * @param {string} userId - The participant's userId to check.
     * @returns {boolean} True if the userId is in the remindedUserIds list.
     */
    const isUserReminded = (userId) => {
        return remindedUserIds?.includes(userId);
    };

    /**
     * Derives the status message shown below the wheel based on the current game state.
     * Priority order: respin > result > spinning > host/non-host ready > waiting.
     */
    let message = "Lock your picks. Let the wheel decide.";

    if (respin) {
        message = isHost
            ? "Everyone is waiting for you to spin"
            : "Waiting for host to spin";
    }
    else if (result) {
        message = "";
    } 
    else if (spinactivate) {
        message = "The wheel is deciding ...";
    }
    else if (!isHost && spinready) {
        message = "Waiting for host to spin";
    }
    else if (isHost && spinready) {
        message = "Everyone is waiting for you to spin";
    }
    else if (getready) {
        message = "Waiting for others to get ready...";
    }

    // ============================================================
    // RENDER
    // ============================================================
    return ( 
        <main className="wheel-page-shell">
            <div
                    className="landing-pattern auth-page-pattern"
                    aria-hidden="true"
                    style={{ "--landing-background-image": `url("${foodPatternBackground}")` }}
            />
            <Navbar />

            <div className="wp-page">

            <div className="wp-button-n-text">
                {/* Top Buttons */}
                <div className="wp-top-buttons">

                    {!getready &&
                    (<button className="wp-black-button wp-black-button--left my-pick"
                    disabled={spinactivate}
                    onClick={() => navigate(`/sessions/${sessionCode}/recommendation`)}
                    > 
                        🔄 REPICK
                    </button>)
                    }
                    {getready &&
                    (<button className="wp-black-button wp-black-button--left group-pick"
                    disabled={spinactivate}
                    onClick={() => setShowGroupPicks(prev => !prev)}
                    > 
                        Group Picks
                    </button>)
                    }

                    <button className="wp-black-button wp-black-button--right"
                    disabled={spinactivate}
                    onClick={() => setShowReadyDropdown(prev => !prev)}
                    >
                        <FiUser /> {readyCount}/{totalParticipants} ready
                    </button>

                    { showReadyDropdown && (
                        <div className="ready-dropdown">
                            
                            <div className="ready-list">
                                {participants.map((p, i) => (
                                    <div key={i} className="ready-item">
                                        <span className="ready-roomDisplayName">{p.roomDisplayName}</span>

                                        <span
                                            className={`ready-isReady ${
                                                p.isReady
                                                    ? "ready"
                                                    : isUserReminded(p.userId)
                                                        ? "reminded"
                                                        : "waiting"
                                            }`}
                                        >
                                            {p.isReady
                                                ? "READY"
                                                : isUserReminded(p.userId)
                                                    ? "REMINDED"
                                                    : "WAITING"}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {isHost && !spinready && remindedUserIds?.length === 0 &&
                            (
                            <button
                                className="reminder-button"
                                onClick={handleSendReminder}
                            >
                                Send Reminder
                            </button>
                            )}
                        </div>
                    )}
                    {showGroupPicks ? (
                    <div className="picks-dropdown">
                        <div className="wp-picks-list">

                            {data?.map((item, i) => (
                                <div key={i} className="wp-pick-card">
                                    
                                    {item.photo?.[0] && (
                                        <img
                                            src={item.photo[0]}
                                            alt={item.option}
                                            className="wp-pick-photo"
                                        />
                                    )}

                                    <div className="wp-pick-info">
                                        <span className="wp-pick-name">{item.option}</span>

                                        <div className="wp-pick-meta">
                                            {item.rating && (
                                                <span className="wp-pick-rating">
                                                    ⭐ {item.rating}
                                                </span>
                                            )}

                                            {item.priceLevel && (
                                                <span className="wp-pick-price">
                                                    {"$".repeat(item.priceLevel)}
                                                </span>
                                            )}

                                            {item.address && (
                                                <span className="wp-pick-address">
                                                    📍 {item.address}
                                                </span>
                                            )}
                                        </div>

                                        <span className="wp-pick-room">
                                            Picked by {item.roomDisplayName}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    ) : (
                        <div className="my-picks">
                            {/* This case never happens */}
                        </div>
                    )}

                </div>
    
                {/* Status Text */}
                <div className="wp-status-container">
                    <div className="wp-text1">
                        {respin ? "LET'S SPIN AGAIN" :
                        result ? "" :
                        spinactivate ? "HERE WE GO !" :
                        getready ? "YOU'RE READY 👍" : ""}
                    </div>

                    {/* Ready Button */}
                    {!getready &&
                    <button 
                        className="wp-orange-button"
                        onClick={handleReady}
                    >
                        READY
                    </button>}

                    <p className="wp-text2">
                        {message}
                    </p>
        
                    {/* Last Result */}
                    {
                    lastResult && (
                        <p className="wp-text3">
                            Last Pick: {lastResult.result} (👍 {lastResult.votes.yes} / 🔄 {lastResult.votes.respin})
                        </p>
                    )}
        

                </div>

            {/* Desktop: combined picks + ready panel with tabs */}
            <div className="wp-desktop-panel">
                
                {/* Tab Headers */}
                <div className="wp-tab-headers">
                    <button
                        className={`wp-tab-btn ${activeTab === 'picks' ? 'active' : ''}`}
                        onClick={() => setActiveTab('picks')}
                    >
                        Group Picks
                    </button>
                    <button
                        className={`wp-tab-btn ${activeTab === 'members' ? 'active' : ''}`}
                        onClick={() => setActiveTab('members')}
                    >
                        Members
                        <span className="wp-tab-badge">{readyCount}/{totalParticipants}</span>
                    </button>
                </div>

                {/* Tab Content */}
                <div className="wp-tab-content">

                    {/* Group Picks Tab */}
                    {activeTab === 'picks' && (
                        getready ? (
                            <div className="wp-picks-list">
                                {data?.map((item, i) => (
                                    <div key={i} className="wp-pick-card">
                                        {item.photo?.[0] && (
                                            <img src={item.photo[0]} alt={item.option} className="wp-pick-photo" />
                                        )}
                                        <div className="wp-pick-info">
                                            <span className="wp-pick-name">{item.option}</span>
                                            <div className="wp-pick-meta">
                                                {item.rating && <span className="wp-pick-rating">⭐ {item.rating}</span>}
                                                {item.priceLevel && <span className="wp-pick-price">{"$".repeat(item.priceLevel)}</span>}
                                                {item.address && <span className="wp-pick-address">📍 {item.address}</span>}
                                            </div>
                                            <span className="wp-pick-room">Picked by {item.roomDisplayName}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="wp-tab-placeholder">Group Picks details only available when you're ready</p>
                        )
                    )}

                    {/* Members Tab */}
                    {activeTab === 'members' && (
                        <div className="wp-ready-list-desktop">
                            {participants.map((p, i) => (
                                <div key={i} className="wp-ready-panel-item">
                                    <span className="wp-ready-panel-name">{p.roomDisplayName}</span>
                                    <span className={`wp-ready-badge ${p.isReady ? "ready" : isUserReminded(p.userId) ? "reminded" : "waiting"}`}>
                                        {p.isReady ? "READY" : isUserReminded(p.userId) ? "REMINDED" : "WAITING"}
                                    </span>
                                </div>
                            ))}
                            {isHost && !spinready && remindedUserIds?.length === 0 && (
                                <button
                                    className="reminder-button"
                                    onClick={handleSendReminder}
                                >
                                    Send Reminder
                                </button>
                            )}
                        </div>
                    )}

                </div>
            </div>

            </div>
    
            {/* Wheel */}
            <div className="wp-wheelntitle">
                <p className="curvy-text" width="400" height="80">Let Fate Pick the Table</p>

                {/* Wheel */}
                <div className="wp-spinning-wheel">
                    <div className="wp-wheel-container">
                        {Array.isArray(data) &&
                        data.length > 0 &&
                        Number.isInteger(prizeNumber) &&
                        prizeNumber >= 0 &&
                        prizeNumber <= data.length ? (  // only render when data is ready
                            <>
                                <div style={{ transform: "rotate(-47deg)", width: "100%" }}>
                                    <Wheel
                                        mustStartSpinning={mustSpin}
                                        prizeNumber={prizeNumber}
                                        data={data.map(item => ({ ...item, option: item.option_truncate }))} // ✅ use truncated for wheel display
                                        spinDuration={0.5} // 👈 MUST be same for all users
                                        onStopSpinning={handleStop}
                                        fontSize={14}
                                        outerBorderColor="#ffffff"
                                        outerBorderWidth={12}
                                        radiusLineColor="#ffffff"
                                        radiusLineWidth={2}
                                        innerRadius={15}
                                        innerBorderColor="#ffffff"
                                        innerBorderWidth={22}
                                        pointerProps={{ style: { display: "none" } }}
                                    />
                                </div>
                                <img src={cropped_wheel} className="wp-wheel-image" />
                                <div
                                    onClick={isHost && spinready && !spinactivate ? handleSpin : undefined}
                                    onMouseEnter={isHost && spinready && !spinactivate ? () => setHovered(true) : undefined}
                                    onMouseLeave={isHost && spinready && !spinactivate ? () => setHovered(false) : undefined}
                                    onTouchStart={isHost && spinready && !spinactivate ? () => setHovered(true) : undefined}
                                    className="wp-spinner"
                                    style={{
                                        transform: hovered ? "scale(1.1)" : "scale(1)",
                                        cursor: isHost && spinready && !spinactivate ? "pointer" : "default",
                                    }}
                                >
                                    <img src={spinner} alt="spinner" style={{ width: "100%" }} />
                                </div>
                            </>
                        ) : (
                            <div className="wp-loading-wrapper">
                                <img
                                    className="wp-loading-illustration"
                                    src={loadingIllustration}
                                    alt=""
                                    aria-hidden="true"
                                />
                                <p className="wp-loading-wheel">Loading wheel...</p> 
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* Voting Popup — shown after each non-final spin result */}
            {showVotePopup && !respin && result && (
                <div className="wp-overlay">
                    <div className="wp-popup">

                        {!finalSpin && 
                        (
                            <div className="wp-result-card">
                                <h2 className="wp-result-title">{result.option}</h2>

                                <div className="wp-result-meta">
                                    <span>⭐ {result.rating}</span>
                                    <span className="wp-result-price">
                                        {"$".repeat(result.priceLevel)}
                                    </span>
                                </div>

                                <p className="wp-result-address">📍 {result.address}</p>
                            </div>
                        )
                        }

                        {!voted && !finalSpin && (
                            <>  
                                <p className="wp-popup-subtitle">Happy with the result?</p>
                                <div className="wp-popup-vote-buttons">
                                    <button className="wp-yes-button" onClick={() => handleVote('accept')}>👍 Yes!</button>
                                    <button className="wp-no-button" onClick={() => handleVote('respin')}>🔄 Respin</button>
                                </div>
                                <p className="wp-warning">{voteWarning}</p>
                            </>
                        )}

                        {voted && !finalSpin && (
                            <div className="wp-popup-waiting">
                            <p className="wp-popup-subtitle">Waiting for others...</p>
                            <div className="wp-popup-vote-buttons">
                                <div className="wp-vote-count-card">
                                    <p className="wp-vote-count-label">YES</p>
                                    <p className="wp-vote-count-number">{votes.yes}</p>
                                </div>
                                <div className="wp-vote-count-card">
                                    <p className="wp-vote-count-label">RESPIN</p>
                                    <p className="wp-vote-count-number">{votes.respin}</p>
                                </div>
                            </div>
                            </div>
                        )}

                        <br />

                        {!finalSpin && (
                            <span className="wp-popup-timer">
                                Deciding in {timeLeft}s...
                            </span>
                        )}
                        
                    </div>
                </div>
            )}
            {/* Final Spin Result — shown when the session is complete */}
            {finalSpin && result && (
                <div className="wp-overlay">
                    <div className="wp-popup">
                        <div className="wp-result-card">
                            <p className="wp-popup-text">🎉 Final result</p>
                            <h2 className="wp-result-title">{result.option}</h2>
                            <div className="wp-result-meta">
                                <span>⭐ {result.rating}</span>
                                <span className="wp-result-price">
                                    {"$".repeat(result.priceLevel)}
                                </span>
                            </div>
                            <p className="wp-result-address">📍 {result.address}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Reminder Popup — shown to participants who haven't marked ready */}
            {showReminderPopup && (
                <ReminderPopup
                    isHost={isHost}
                    onClose={() => setShowReminderPopup(false)}
                />
            )}
        </div>
        </main>
    );
}