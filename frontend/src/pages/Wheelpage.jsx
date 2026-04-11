// ============================================================
// IMPORTS
// ============================================================
import '@fontsource/suez-one';
import '@fontsource/inter';
import '@fontsource/inter/700.css';
import { FiUser } from "react-icons/fi";
import { Wheel } from 'react-custom-roulette';
import { useEffect, useState, useRef } from "react";
// import wheelframe from "../assets/wheelframe.png"
import cropped_wheel from "../assets/cropped_wheel.png"
import spinner from "../assets/spinner.png"
import { ifRespin, getHost } from '../services/wheelService';
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import './Wheelpage.css';

// ============================================================
// CONSTANTS
// ============================================================
const socket = io(import.meta.env.VITE_API_BASE_URL);
const DURATION = 30 // seconds - duration for voting

// Later replace options with api
const options = [
    'Golden Bamboo Kitchen',
    'Urban Spice House',
    'The Velvet Fork',
    'Midnight Noodle Bar',
    'Salt & Ember',
    'Blue Harbor Grill',
    'The Hungry Lantern',
    'Olive & Thyme Bistro',
    'Crimson Plate',
    'Driftwood Café',
    'The Rustic Fig',
    'Neon Tiger Eatery',
    'Maple Street Kitchen',
    'The Saffron Table',
    'Cloud Nine Diner'
    ];

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

const data = options.map((option, i) => ({
  option,
  style: { backgroundColor: wheelcolors[i % wheelcolors.length], textColor: '#ffffff' }
}));

// ============================================================
// COMPONENT
// ============================================================
export default function Wheelpage() {

    const navigate = useNavigate();
    const { sessionid } = useParams();

    const spin_no = 2; // TODO: replace with API when available
    // const [spin_no, setSpinNo] = useState(0); // enable this when api is available

    // --- Wheel State ---
    const [mustSpin, setMustSpin] = useState(false);
    const [prizeNumber, setPrizeNumber] = useState(0);
    const [result, setResult] = useState(null);
    const [spinactivate, spinActivate] = useState(false);
    const [hovered, setHovered] = useState(false);

    // --- User State ---
    const [getready, setReady] = useState(false);
    const [isHost, setIsHost] = useState(true); // get this from API/session
    const [spinready, spinReady] = useState(false); // TODO: to pass value to spinReady from API

    // --- Vote State ---
    const [voted, setVoted] = useState(false);
    const [votes, setVotes] = useState({ yes: 0, respin: 0 });
    const [respin, setRespin] = useState(""); // to pass parameters true as respin and false as happy
    const [timeLeft, setTimeLeft] = useState(DURATION);
    const [lastResult, setLastResult] = useState(null);

    // --- Refs (to capture latest values in async callbacks) ---
    const resultRef = useRef(result); // Use refs to capture the latest values
    const votesRef = useRef(votes); // Use refs to capture the latest values

    // --- Test State (TODO: remove when API is ready) ---
    const [userid, setUserid] = useState(null);
    const [inputId, setInputId] = useState("");
  

    // ============================================================
    // HANDLERS
    // ============================================================
    const handleSpin = () => {
        const newPrize = Math.floor(Math.random() * data.length);
        setPrizeNumber(newPrize);
        setResult(null);
        setMustSpin(true);
        spinActivate(true);
        setRespin("");
        setVoted(false);

        // setSpinNo(prev => prev + 1); // use this when there's api available

        // notify all users in the session to spin
        socket.emit("spin", {sessionid, prizeNumber: newPrize });
    };

    const handleStop = () => {
        setMustSpin(false);
        setResult(data[prizeNumber].option);
        setHovered(false);
    };

    const handleVote = (choice) => {
        setVoted(true);

        // broadcast vote to all users in the session
        socket.emit("vote", { sessionid, spin_no: spin_no, choice });
      };
    
    // ============================================================
    // EFFECTS
    // ============================================================
    
    // Keep refs updated with latest state values
    useEffect(() => { votesRef.current = votes; }, [votes]);
    useEffect(() => { resultRef.current = result; }, [result]);

    // Log socket connection
    useEffect(() => {
        socket.on("connect", () => {
          console.log("my socket id:", socket.id);
        });
    }, []);

    // Check if user is host (runs after userid is set)
    useEffect(() => {
        if (!userid) return; // don't run if userid is not set yet
        
        const checkHost = async () => {
          const response = await getHost(sessionid, userid);
          console.log("if host:", response);
          setIsHost(response);
        };
        checkHost();
      }, [userid]);
    
    // Socket listeners (runs after userid is set)
    useEffect(() => {
        if (!userid) return; // wait for userid

        // join the session
        socket.emit("join_session", {sessionid, userid});

        // listen for spin from host
        socket.on("spin", (data) => {
            setPrizeNumber(data.prizeNumber);
            setResult(null);
            setMustSpin(true);
            spinActivate(true);
            setRespin("");
            setVoted(false);
        });

        // listen for vote updates
        socket.on("vote_update", (counts) => {
            // console.log(counts);
            const countMap = Object.fromEntries(
                counts.map(item => [item.decision, Number(item.count)])
              );
            // console.log("checkVote", countMap);
            setVotes({ respin: countMap.respin || 0, yes: countMap.happy || 0 });
        });

        // listen for respin decision
        socket.on("respin_update", (isrespin) => {
            setRespin(isrespin);
            if (!isrespin) {
                navigate(`/result/session/${sessionid}`, {
                    state: {votes: votesRef.current, result: resultRef.current}
                });
              }
        });

        return () => {
            socket.off("spin");
            socket.off("vote_update");
            socket.off("respin_update");
        };
    }, [sessionid, userid]);

    // Voting timer (runs after result is set)
    useEffect(() => {

        if (!result) return;
      
        setTimeLeft(DURATION);
      
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
          const shouldRespin = await ifRespin(sessionid, spin_no);
          setRespin(shouldRespin);
          // broadcast respin decision to all users
          socket.emit("respin", { sessionid: sessionid, isrespin: shouldRespin });

          // navigate to result page if majority is happy
            if (!shouldRespin) {
                navigate(`/result/session/${sessionid}`, {
                    state: {votes: votesRef.current, result: resultRef.current}
                });
            }

            if (shouldRespin) {
                setLastResult({ result: resultRef.current, votes: votesRef.current });
              }
        }, DURATION*1000);

        spinActivate(false);
      
        return () => {
          clearTimeout(timer);
          clearInterval(countdown);
        };
    }, [result]);
    
    // ============================================================
    // TEST UI - TODO: remove when API is ready
    // ============================================================
    if (!userid) {
        return (
            <div style={{ padding: "20px" }}>
            <p>Enter your test user ID:</p>
            <input 
                value={inputId} 
                onChange={(e) => setInputId(e.target.value)} 
                placeholder="e.g. 1, 2, 3"
            />
            <button onClick={() => setUserid(inputId)}>Join</button>
            </div>
        );
    }
    

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <div className="wp-page">

            <div className="wp-button-n-text">
                {/* Top Buttons */}
                <div className="wp-top-buttons">
                    <button className="wp-black-button wp-black-button--left">
                        My Picks
                    </button>
                    <button className="wp-black-button wp-black-button--right">
                        <FiUser /> 2/6 ready
                    </button>
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
                        {isHost && respin ? "Everyone is waiting for you to spin" :
                        respin ? "Waiting for host to spin" :
                        result ? "" :
                        spinactivate ? "The wheel is deciding ..." :
                        spinready ? "Waiting for host to spin" :
                        getready ? "Waiting for others to get ready..." :
                        "Lock your picks. Let the wheel decide."}
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
                        onClick={!getready ? () => setReady(true) : undefined}
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

            <div className="wp-spinning-wheel">
                <div className="wp-wheel-container">
                    {/* Wheel */}
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

                    {/* Frame Overlay */}
                    <img src={cropped_wheel} className="wp-wheel-image" />

                    {/* Spinner */}
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
                </div>
            </div>
            </div>
            {/* Voting Popup */}
            {!respin && result && (
                <div className="wp-overlay">
                    <div className="wp-popup">
                        <p className="wp-popup-text">🎉 {result}</p>
                        {!voted && <p className="wp-popup-subtitle">Happy with the result?</p>}
                        {!voted ? (
                            <div className="wp-popup-vote-buttons">
                                <button className="wp-yes-button" onClick={() => handleVote('yes')}>👍 Yes!</button>
                                <button className="wp-no-button" onClick={() => handleVote('respin')}>🔄 Respin</button>
                            </div>
                        ) : (
                            <p className="wp-popup-waiting">
                                Waiting for others: {votes.yes} yes / {votes.respin} respin
                            </p>
                        )}
                        <br />
                        <span className="wp-popup-timer">
                            Deciding in {timeLeft}s...
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

