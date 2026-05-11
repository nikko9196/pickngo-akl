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
const socket = io(import.meta.env.VITE_API_BASE_URL);
const DURATION = 15 // seconds - duration for voting

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
export default function Wheelpage() {


    const navigate = useNavigate();
    const { sessionCode } = useParams();
    const { token } = useAuth();

    // --- Wheel State ---
    const [mustSpin, setMustSpin] = useState(false);
    const [prizeNumber, setPrizeNumber] = useState(0);
    const [result, setResult] = useState(null);
    const [spinactivate, spinActivate] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [data, setData] = useState(null);       
    const [sessionId, setSessionId] = useState(null);
    const sessionIdRef = useRef(null); // for socket listeners and timeouts
    const [finalSpin, setFinalSpin] = useState(null);

    // --- User State ---
    const [getready, setReady] = useState(false);
    const [isHost, setIsHost] = useState(false); 
    const [spinready, setSpinReady] = useState(false); 
    const [readyCount, setReadyCount] = useState(0);
    const [totalParticipants, setTotalParticipants] = useState(0);
    const [participants, setParticipants] = useState([]);
    const [currentUserId, setCurrentUserId] = useState(null);

    // --- Vote State ---
    const [voted, setVoted] = useState(false);
    const [votes, setVotes] = useState({ yes: 0, respin: 0});
    const [respin, setRespin] = useState(null); // to pass parameters true as respin and false as happy
    const [timeLeft, setTimeLeft] = useState(DURATION);
    const [lastResult, setLastResult] = useState(null);
    const [showVotePopup, setShowVotePopup] = useState(false);
    const [voteWarning, setVoteWarning] = useState("");

    // --- Refs (to capture latest values in async callbacks) ---
    const resultRef = useRef(result); // Use refs to capture the latest values
    const votesRef = useRef(votes); // Use refs to capture the latest values
    const isHostRef = useRef(false); // check if player is the host
    const dataRef = useRef(null);
    const currentUserIdRef = useRef(null);

    // --- Dropdown State ---
    const [showReadyDropdown, setShowReadyDropdown] = useState(false);
    const [showGroupPicks, setShowGroupPicks] = useState(false);

    // --- Reminder State ---
    const {
        showReminderPopup,
        setShowReminderPopup, 
        remindedUserIds,
        setRemindedUserIds
    } = useReminderPopup(socket, currentUserIdRef);

    // --- Tab ---
    const [activeTab, setActiveTab] = useState('picks');
    
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
    const handleSpin = async () => {
        try {
            const response = await spinWheel(token, sessionId);
            // console.log(token);
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
            // console.log("debug vote warning", voteWarning);
    
            // notify all users in the session to spin
            socket.emit("spin", { 
                sessionCode, 
                prizeNumber: newPrize, 
                finalSpin: ifFinalSpin, 
                sessionId });

        } catch (error) {
            console.error("Failed to spin wheel:", error);
        }
    };

    const handleStop = () => {
        setMustSpin(false);
        setHovered(false);
    
        // only host decides the final result
        if (isHostRef.current) {
    
            const spinResult = data[prizeNumber];
            // console.log("spinResult:", spinResult);
            if (!spinResult) {
                console.error("Invalid spin result");
                return;
            }
    
            // host updates local state
            setResult(spinResult);
    
            // broadcast authoritative result
            socket.emit("spin_finished", {
                sessionCode,
                result: spinResult,
                finalSpin,
                sessionId
            });
    
            // final navigation
            if (finalSpin) {
                setTimeout(() => {
                    navigate(`/sessions/${sessionCode}/result`, {
                        state: {
                            votes: { yes: 0, respin: 0 }
                        }
                    });
                }, 3000);
            }
        }
    };

    const handleVote = async (choice) => {
        try {
            await submitVoteApi(token, sessionId, choice);
            socket.emit("vote", { sessionCode, sessionId });
    
            // re-sync from backend (source of truth)
            const res = await getWheelState(token, sessionId);
            setVoted(hasUserVoted(currentUserIdRef.current, res.session));
            // console.log("vote reset status after handling Vote:", voted);
    
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

    const handleReady = async () => {
        try {
            setReady(true);
            await sendReady(token, sessionId);
            socket.emit("ready", {sessionCode,sessionId});
    
        } catch (err) {
            console.error(err);
        }
    };

    const resetRoundState = () => {
        setResult(null);
        setVoted(false);
        // console.log("vote reset status for spin", voted);
        setRespin(null);
        setVotes({ yes: 0, respin: 0 });
        setTimeLeft(DURATION);
        setVoteWarning(null);
    };
    
    const truncate = (text, maxLength = 15) => {
        return text.length > maxLength
            ? text.slice(0, maxLength) + "…"
            : text;
    };

    const handleSendReminder = async () => {
        try {
            const res = await sendRemind(token, sessionId);
    
            socket.emit("send_reminder", {
                sessionCode,
                sessionId
            });
    
            setRemindedUserIds(res.remindedUserIds);
        } catch (err) {
            console.error(err);
        }
    };

    const hasUserVoted = (userId, session) => {
        return session?.voteSummary?.votedUserIds?.includes(userId);
    };
    // ============================================================
    // EFFECTS
    // ============================================================

    useEffect(() => { dataRef.current = data; }, [data]);

    // keep sessionIdRef and sessionId in sync
    useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

    useEffect(() => {
        currentUserIdRef.current = currentUserId;
    }, [currentUserId]);

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

    const isLoadingRef = useRef(false); // add with other refs

    // fetch wheel data inside useEffect
    useEffect(() => {
        async function loadWheelData() {
        if (isLoadingRef.current) return; // prevent duplicate calls
        isLoadingRef.current = true;
        // console.log("token:",token);
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
            
            // ✅ restore wheel state if user rejoined mid-session
            const wheelState = await getWheelState(token, id);
            const currentResult = wheelState.session?.currentWheelResult;
            const sessionStatus = wheelState.session?.status;
            const sessionData = wheelState.session ?? wheelState;
            const wheelItems = sessionData.wheelItems || [];
            const voted = hasUserVoted(user.id, wheelState.session);
            setVoted(voted);
            

            // ✅ restore latest voting result if user rejoined mid-session
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

                // IMPORTANT: also overwrite live vote state
                setVotes({
                    yes: lastRoundVoteSummary.acceptCount ?? 0,
                    respin: lastRoundVoteSummary.respinCount ?? 0
                });
            }

            // ✅ restore Reminder status if user rejoined mid-session
            const reminderRes = await getRemind(token, id);
            const remindedUserIdsRes = reminderRes?.remindedUserIds;
            if (Array.isArray(remindedUserIdsRes) && remindedUserIdsRes.length > 0) {
                setRemindedUserIds(remindedUserIdsRes);
            }

            // ✅ Only build wheel if status is selecting
            let finalWheelItems = wheelItems;
            if (sessionStatus === 'selecting') {
                const { session: newBuilt } = await buildWheelApi(token, id);
                finalWheelItems = newBuilt.wheelItems;
                socket.emit("build_wheel", { sessionCode });
            }

            const fetchedData = mapWheelItems(finalWheelItems);

            setData(fetchedData);
            dataRef.current = fetchedData;

            if (sessionStatus === "voting" && currentResult?.placeId) {
                // ✅ wheel already stopped, restore voting UI
                // setShowVotePopup(true);
                const prize = fetchedData.findIndex(item => item.placeId === currentResult.placeId);
                if (prize >= 0) {
                    setPrizeNumber(prize);
                    setResult(fetchedData[prize]);
                    setMustSpin(false);
                    spinActivate(false);
                }
            } 

            // // Re-emit join_session so backend can send current spin state
            socket.emit("join_session", { sessionCode, userId: user.id });

            isLoadingRef.current = false; // reset on error to allow retry

        } catch (error) {
            console.error("Failed to load wheel data:", error);
            isLoadingRef.current = false; // reset on error to allow retry
        }
    }

    if (token && sessionCode) {
        loadWheelData();
    }
    }, [token, sessionCode]);

    // Keep refs updated with latest state values
    useEffect(() => { votesRef.current = votes; }, [votes]);
    useEffect(() => { resultRef.current = result; }, [result]);
    useEffect(() => { isHostRef.current = isHost; }, [isHost]);

    // Check if user is host (runs after userid is set)
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

    // Socket listeners (runs after userid is set)
    useEffect(() => {
        if (!token || !sessionCode) return; // use token instead of userid

        // listen for spin from host
        socket.on("spin", ({ prizeNumber, placeId, finalSpin, startAt}) => {
            const resolvedPrize = prizeNumber !== null
                ? prizeNumber
                : dataRef.current?.findIndex(item => item.placeId === placeId) ?? 0;
            
            // for start-time sync of spinning time accross different players
            const delay = startAt - Date.now();
        
            setPrizeNumber(resolvedPrize);
            setFinalSpin(finalSpin);
            resetRoundState(); 
        
            setTimeout(() => {
                setMustSpin(true);
                spinActivate(true);
            }, Math.max(delay, 0));
        });

        // socket.on("vote_update", (counts) => {
        //     setVotes({ yes: counts.acceptCount, respin: counts.respinCount });
        // });
        socket.on("vote_update", async () => {
            const res = await getWheelState(token, sessionIdRef.current);
        
            const votedNow = hasUserVoted(currentUserIdRef.current, res.session);
            setVoted(votedNow);
        
            setVotes({
                yes: res.session.voteSummary.acceptCount || 0,
                respin: res.session.voteSummary.respinCount || 0
            });
        });

        socket.on("respin_update", async ({ isrespin, finalSpin }) => {

            setRespin(isrespin);
        
            try {
        
                // ✅ ALWAYS fetch authoritative backend state
                const reload = await reloadWheel(
                    token,
                    sessionIdRef.current
                );
        
                const lastRoundResult =
                    reload.session?.lastWheelResult;
        
                const lastRoundVoteSummary =
                    reload.session?.lastVoteSummary;
        
                // ✅ restore latest round result safely
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
        
                // ✅ navigate if round ended
                if (!isrespin || finalSpin === true) {
        
                    navigate(`/sessions/${sessionCode}/result`, {
                        state: {
                            votes: {
                                yes: lastRoundVoteSummary?.acceptCount ?? 0,
                                respin: lastRoundVoteSummary?.respinCount ?? 0
                            }
                        }
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

        // listen for wheel built - loads wheel data for non-host users
        socket.on("wheel_built", async () => {
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

        // listen for wheel reload when respin
        socket.on("wheel_reloaded", async () => {
            try {
                const { session } = await reloadWheel(token, sessionIdRef.current); // use ref
                const fetchedData = mapWheelItems(session.wheelItems);
                setData(fetchedData);
            } catch (error) {
                console.error("Failed to reload wheel:", error);
            }
        });

        socket.on("ready_update", ({ readyCount, totalParticipants, allReady, participants }) => {
            setReadyCount(readyCount);
            setTotalParticipants(totalParticipants);
            setSpinReady(allReady);
            setParticipants(participants);
        });

        socket.on("spin_finished", ({ result, finalSpin }) => {

            // listeners sync from host result
            if (!isHostRef.current) {
                setResult(result);
            }
        
            setFinalSpin(finalSpin);
            setMustSpin(false);
            setHovered(false);
        
            // non-host final navigation
            if (finalSpin && !isHostRef.current) {
                setTimeout(() => {
                    navigate(`/sessions/${sessionCode}/result`, {
                        state: {
                            votes: { yes: 0, respin: 0 }
                        }
                    });
                }, 3000);
            }
        });
        
        return () => {
            socket.off("spin");
            socket.off("vote_update");
            socket.off("respin_update");
            socket.off("wheel_built"); 
            socket.off("wheel_reloaded"); 
            socket.off("ready_update");
            socket.off("spin_finished");
        };
    }, [sessionCode, token]);

    // Voting timer (runs after result is set)
    useEffect(() => {

        if (!result) return;

        // setShowVotePopup(true);
        // only show popup if user has not voted
        // console.log("voted status during voting timer:", voted);
        if (!voted) {
            setShowVotePopup(true);
        }

        setTimeLeft(DURATION);

        // ✅ if final spin, no need for voting timer
        if (finalSpin) {
            spinActivate(false);
            setShowVotePopup(false);
            return;
        }
      
        const countdown = setInterval(async () => {
          setTimeLeft(prev => {
            if (prev <= 1) {
              clearInterval(countdown);
              return 0;
            }
            return prev - 1;
          });
      
        }, 1000);
      
        const timer = setTimeout(async () => {
            if (!isHostRef.current) return; // use ref not state
            setShowVotePopup(false); // ✅ hide popup when time ends
            try {
                const shouldRespin = await ifRespin(token, sessionIdRef.current);
                setRespin(shouldRespin);
                socket.emit("respin", { sessionCode, isrespin: shouldRespin, finalSpin, sessionId: sessionIdRef.current });
        
                if (!shouldRespin) {
                    navigate(`/sessions/${sessionCode}/result`, {
                        state: { votes: votesRef.current}
                    });
                }
        
                if (shouldRespin) {
                    socket.emit("reload_wheel", { sessionCode });
                }
            } catch (error) {
                console.error("Vote resolution error:", error.message);
            }
        }, DURATION * 1000);

        spinActivate(false);
      
        return () => {
          clearTimeout(timer);
          clearInterval(countdown);
        };
    }, [result]);

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

    useEffect(() => {
        if (lastResult) {
            // console.log("lastResult:", lastResult);
        }
    }, [lastResult]);

    const isUserReminded = (userId) => {
        return remindedUserIds?.includes(userId);
    };

    // Small Reminder Text Message  
    let message = "Lock your picks. Let the wheel decide.";

    if (result) {
        message = "";
    } 
    else if (spinactivate) {
        message = "The wheel is deciding ...";
    }
    else if (respin) {
        message = isHost
            ? "Everyone is waiting for you to spin"
            : "Waiting for host to spin";
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

            {/* ✅ Desktop: combined picks + ready panel with tabs */}
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
                                    onClick={isHost && getready && !spinactivate ? handleSpin : undefined}
                                    onMouseEnter={isHost && getready && !spinactivate ? () => setHovered(true) : undefined}
                                    onMouseLeave={isHost && getready && !spinactivate ? () => setHovered(false) : undefined}
                                    onTouchStart={isHost && getready && !spinactivate ? () => setHovered(true) : undefined}
                                    className="wp-spinner"
                                    style={{
                                        transform: hovered ? "scale(1.1)" : "scale(1)",
                                        cursor: isHost && getready ? "pointer" : "default",
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
            {/* Voting Popup */}
            {showVotePopup && !respin && result && (
                <div className="wp-overlay">
                    <div className="wp-popup">

                        {!finalSpin && 
                        (
                            <div className="wp-result-card">
                                {/* <h2 className="wp-result-title">{result.option}</h2> */}
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

                        {finalSpin && 
                        (   
                            <div className="wp-result-card">
                                <p className="wp-popup-text">
                                🎉 Final result
                                </p>
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
                        <br />

                        {!finalSpin && (
                            <span className="wp-popup-timer">
                                Deciding in {timeLeft}s...
                            </span>
                        )}
                        
                    </div>
                </div>
            )}
            {/* Reminder Popup */}
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

