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
sendReady, sendRemind} from "../api/userselections";
import { useAuth } from "../context/useAuth";
import { getCurrentUser } from "../api/auth";

// ============================================================
// CONSTANTS
// ============================================================
const socket = io(import.meta.env.VITE_API_BASE_URL);
const DURATION = 10 // seconds - duration for voting

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

    // const [spin_no, setSpinNo] = useState(0); // enable this when api is available

    // --- Wheel State ---
    const [mustSpin, setMustSpin] = useState(false);
    const [prizeNumber, setPrizeNumber] = useState(0);
    const [result, setResult] = useState(null);
    const [spinactivate, spinActivate] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [data, setData] = useState(null);         // ✅ add this
    const [sessionId, setSessionId] = useState(null);
    const sessionIdRef = useRef(null);              // for socket listeners and timeouts
    const [finalSpin, setFinalSpin] = useState(null);
    // const finalSpinRef = useRef(null); // ✅ add with other refs

    // --- User State ---
    const [getready, setReady] = useState(false);
    const [isHost, setIsHost] = useState(true); // get this from API/session
    const [spinready, setSpinReady] = useState(false); // TODO: to pass value to spinReady from API
    const [readyCount, setReadyCount] = useState(0);
    const [totalParticipants, setTotalParticipants] = useState(0);
    const [participants, setParticipants] = useState([]);
    const [sentReminders, setReminders] = useState({remindedUserIds: []});
    const [currentUserId, setCurrentUserId] = useState(null);

    // --- Vote State ---
    const [voted, setVoted] = useState(false);
    const [votes, setVotes] = useState({ yes: 0, respin: 0 });
    const [respin, setRespin] = useState(""); // to pass parameters true as respin and false as happy
    const [timeLeft, setTimeLeft] = useState(DURATION);
    const [lastResult, setLastResult] = useState(null);

    // --- Refs (to capture latest values in async callbacks) ---
    const resultRef = useRef(result); // Use refs to capture the latest values
    const votesRef = useRef(votes); // Use refs to capture the latest values
    
    // --- Dropdown State ---
    const [showReadyDropdown, setShowReadyDropdown] = useState(false);
    const [showGroupPicks, setShowGroupPicks] = useState(false);
    const [showReminderPopup, setShowReminderPopup] = useState(false);
    

    // ============================================================
    // HANDLERS
    // ============================================================
    const handleSpin = async () => {
        try {
            // const { session: spinResult } = await spinWheel(token, sessionId);
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
            socket.emit("spin", { sessionCode, prizeNumber: newPrize, finalSpin: ifFinalSpin });

        } catch (error) {
            console.error("Failed to spin wheel:", error);
        }
    };

    const handleStop = () => {
        setMustSpin(false);
        setResult(data[prizeNumber].option);
        setHovered(false);

        // ✅ navigate after wheel stops if final spin
        if (finalSpin) {
            setTimeout(() => {
                navigate(`/sessions/${sessionCode}/result`, {
                    state: { votes: { yes: 0, respin: 0 }, result: resultRef.current }
                });
            }, 3000); // ✅ small delay so user sees the result before navigating
        }
    };

    const handleVote = async (choice) => {
        setVoted(true);
    
        try {
            await submitVoteApi(token, sessionId, choice); // call the API
            socket.emit("vote", { sessionCode, sessionId });
        } catch (error) {
            console.error("Failed to submit vote:", error);
        }
    
        // broadcast vote to all users in the session
        // socket.emit("vote", { sessionCode, sessionId });
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

    const isCurrentUserReminded = () => {
        if (!currentUserId) return false;
        return sentReminders?.remindedUserIds?.includes(currentUserId);
    };
    
    // ============================================================
    // EFFECTS
    // ============================================================

    // keep sessionIdRef and sessionId in sync
    useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

    // featch current user
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

    // ✅ fetch wheel data inside useEffect
    useEffect(() => {
        async function loadWheelData() {
            try {
                const { session } = await getSessionByCode(token, sessionCode);
                const id = session.id;
                setSessionId(id);
    
                let wheelData;
    
                if (session.status === "selecting" || !session.wheelItems?.length) {
                    // ✅ only build if not already built
                    const { session: built } = await buildWheelApi(token, id);
                    wheelData = built;
                    socket.emit("build_wheel", { sessionCode });
                } else {
                    // ✅ already built, use existing wheelItems
                    wheelData = session;
                }
    
                const fetchedData = wheelData.wheelItems.map((item, i) => ({
                    option: item.name,
                    roomDisplayName: item.roomDisplayName, // 👈 keep this
                    style: {
                        backgroundColor: wheelcolors[i % wheelcolors.length],
                        textColor: '#ffffff'
                    }
                }));
                setData(fetchedData);
    
            } catch (error) {
                console.error("Failed to load wheel data:", error);
            }
        }
    
        if (token && sessionCode) {
            loadWheelData();
        }
    }, [token, sessionCode]);

    // Keep refs updated with latest state values
    useEffect(() => { votesRef.current = votes; }, [votes]);
    useEffect(() => { resultRef.current = result; }, [result]);

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
        if (!token || !sessionCode) return; // ✅ use token instead of userid

        // join the session
        socket.emit("join_session", {sessionCode, userid: token });

        // listen for spin from host
        socket.on("spin", (data) => {
            setPrizeNumber(data.prizeNumber);
            setFinalSpin(data.finalSpin); // ✅ non-host users get it here
            setResult(null);
            setMustSpin(true);
            spinActivate(true);
            setRespin("");
            setVoted(false);
        });

        socket.on("vote_update", (counts) => {
            setVotes({ yes: counts.acceptCount || 0, respin: counts.respinCount || 0 });
        });

        // listen for respin decision
        socket.on("respin_update", ({ isrespin, finalSpin }) => {
            console.log("respin_update received, finalSpinRef.current:", finalSpin);
            setRespin(isrespin);
            if (!isrespin || finalSpin === true) {
                navigate(`/sessions/${sessionCode}/result`, {
                    state: {votes: votesRef.current, result: resultRef.current}
                });
              }
            
            if (isrespin  && !finalSpin) {
                setLastResult({ result: resultRef.current, votes: votesRef.current }); // ✅ all users
            }
        });

        // listen for wheel built - loads wheel data for non-host users
        socket.on("wheel_built", async () => {
            try {
                const { session } = await getSessionByCode(token, sessionCode);
                const { session: wheelData } = await buildWheelApi(token, session.id);
                const fetchedData = wheelData.wheelItems.map((item, i) => ({
                    option: item.name,
                    roomDisplayName: item.roomDisplayName, // 👈 keep this
                    style: {
                        backgroundColor: wheelcolors[i % wheelcolors.length],
                        textColor: '#ffffff'
                    }
                }));
                setSessionId(session.id);
                setData(fetchedData);

                setParticipants(session.participants || []);
                setTotalParticipants(session.participants?.length || 0);
                setReadyCount(
                    session.participants?.filter(p => p.isReady).length || 0
                );
            } catch (error) {
                console.error("Failed to load wheel on wheel_built event:", error);
            }
        });

        // listen for wheel reload when respin
        socket.on("wheel_reloaded", async () => {
            try {
                const { session } = await reloadWheel(token, sessionIdRef.current); // ✅ use ref
                const fetchedData = session.wheelItems.map((item, i) => ({
                    option: item.name,
                    roomDisplayName: item.roomDisplayName, // 👈 keep this
                    style: {
                        backgroundColor: wheelcolors[i % wheelcolors.length],
                        textColor: '#ffffff'
                    }
                }));
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

        socket.on("reminder_sent", ({ remindedUserIds }) => {
            console.log("REMINDER RECEIVED:", { remindedUserIds });
            setReminders({ remindedUserIds });
        
            if (!currentUserId) return; // wait until loaded
        
            const shouldShow = remindedUserIds.includes(currentUserId);
        
            if (shouldShow) {
                setShowReminderPopup(true);
            }
        });
        
        return () => {
            socket.off("spin");
            socket.off("vote_update");
            socket.off("respin_update");
            socket.off("wheel_built"); 
            socket.off("wheel_reloaded"); 
            socket.off("ready_update");
            socket.off("reminder_sent")
        };
    }, [sessionCode, token]);

    // Voting timer (runs after result is set)
    useEffect(() => {

        if (!result) return;
      
        setTimeLeft(DURATION);

        // ✅ if final spin, no need for voting timer
        if (finalSpin) {
            spinActivate(false);
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
            const shouldRespin = await ifRespin(token, sessionIdRef.current);
            setRespin(shouldRespin);
            // broadcast respin decision to all users
            socket.emit("respin", { sessionCode, isrespin: shouldRespin, finalSpin });

            // navigate to result page if majority is happy
            if (!shouldRespin) {
                navigate(`/sessions/${sessionCode}/result`, {
                    state: {votes: votesRef.current, result: resultRef.current}
                });
            }

            // if respin is true, reload the wheel items as it will remove the rejected result from the options
            if (shouldRespin) {
                socket.emit("reload_wheel", { sessionCode }); // ✅ notify all users to reload
            }

        }, DURATION*1000);

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
        if (!currentUserId) return;
        if (!sentReminders?.remindedUserIds) return;
    
        setShowReminderPopup(
            sentReminders.remindedUserIds.includes(currentUserId)
        );
    }, [currentUserId, sentReminders]);

    const isUserReminded = (userId) => {
        return sentReminders?.remindedUserIds?.includes(userId);
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
        <div className="wp-page">
        
            <div className="wp-button-n-text">
                {/* Top Buttons */}
                <div className="wp-top-buttons">
                    {!getready &&
                    (<button className="wp-black-button wp-black-button--left"
                    disabled={spinactivate}
                    onClick={() => navigate(`/sessions/${sessionCode}/recommendation`)}
                    > 
                        My Picks
                    </button>)
                    }
                    {getready &&
                    (<button className="wp-black-button wp-black-button--left"
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
                                <span className="ready-header">MEMBERS</span>
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

                            {isHost && !spinready && sentReminders?.remindedUserIds?.length === 0 &&
                            (
                            <button
                                className="reminder-button"
                                onClick={() => {
                                    try {
                                        socket.emit("send_reminder", {
                                            sessionCode,
                                            sessionId
                                        });
                            
                                    } catch (err) {
                                        console.error(err);
                                    }
                                }}
                            >
                                Send Reminder
                            </button>
                            )}
                        </div>
                    )}
                    { showGroupPicks ? (
                        <div className="picks-dropdown">
                            <div className="ready-list">
                            <span className="ready-header">MEMBERS PICKS</span>
                                {data?.map((item, i) => (
                                    <div key={i} className="ready-item">
                                        <span className="ready-roomDisplayName">{item.roomDisplayName}</span>
                                        <span className="pick-option">{item.option}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="my-picks">
                            {/* your existing My Picks UI */}
                        </div>
                    )}

                </div>
    
                {/* Status Text */}
                <div className="wp-status-container">
                    <p className="wp-text1">
                        {respin ? "LET'S SPIN AGAIN" :
                        result ? "" :
                        spinactivate ? "HERE WE GO !" :
                        getready ? "YOU'RE READY 👍" : "READY"}
                    </p>
                    <p className="wp-text2">
                        {message}
                    </p>
        
                    {/* Last Result */}
                    {lastResult && (
                        <p className="wp-text3">
                            Last Pick: {lastResult.result} (👍 {lastResult.votes.yes} / 🔄 {lastResult.votes.respin})
                        </p>
                    )}
        
                    {/* Ready Button */}
                    <button 
                        className="wp-orange-button"
                        style={{ visibility: getready ? "hidden" : "visible" }} 
                        onClick={handleReady}
                    >
                        READY
                    </button>
                </div>
            </div>
    
            {/* Wheel */}
            
            <div className="wp-wheelntitle">
                {/* <p className="wp-result-title">Let Fate Pick the Table</p> */}

                <svg className="curvy-text" width="400" height="120">
                <path id="curve" d="M 10 120 Q 230 20 400 130" fill="transparent" />
                <text>
                    <textPath href="#curve" startOffset="50%" textAnchor="middle">
                    Let Fate Pick the Table
                    </textPath>
                </text>
                </svg>

                {/* Wheel */}
                <div className="wp-spinning-wheel">
                    <div className="wp-wheel-container">
                        {data ? (  // ✅ only render when data is ready
                            <>
                                <div style={{ transform: "rotate(-47deg)", width: "100%" }}>
                                    <Wheel
                                        mustStartSpinning={mustSpin}
                                        prizeNumber={prizeNumber}
                                        data={data}
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
                            <p>Loading wheel...</p>  // ✅ show while fetching
                        )}
                    </div>
                </div>
            </div>
            {/* Voting Popup */}
            {!respin && result && (
                <div className="wp-overlay">
                    <div className="wp-popup">
                        
                        {!finalSpin && (
                        <h1 className="wp-popup-text"> {result}</h1>
                        )}

                        {!voted && !finalSpin && (
                            <>  
                                <p className="wp-popup-subtitle">Happy with the result?</p>
                                <div className="wp-popup-vote-buttons">
                                    <button className="wp-yes-button" onClick={() => handleVote('accept')}>👍 Yes!</button>
                                    <button className="wp-no-button" onClick={() => handleVote('respin')}>🔄 Respin</button>
                                </div>
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

                        {finalSpin && (
                            <p className="wp-popup-text">
                                🎉 Final result: {result}
                            </p>
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
            {/* Reminder Popup */}
            {showReminderPopup && (
                <div className="wp-overlay">
                    <div className="wp-popup">
                        <p className="wp-popup-text">🔔 REMINDER</p>
                        <p className="wp-popup-subtitle">
                            You have been reminded to get ready!
                        </p>

                        <button
                            className="reminder-button"
                            onClick={() => {
                                setShowReminderPopup(false);
                            
                                setReminders(prev => ({
                                    remindedUserIds: prev.remindedUserIds.filter(
                                        id => id !== currentUserId
                                    )
                                }));
                            }}
                        >
                            GOT IT
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

