const { findSessionById, findSessionByCode } = require('../services/sessionService');
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../services/authService");

/**
 * Checks whether a given userId is the host of a session.
 * @param {string} sessionId - The MongoDB session ID.
 * @param {string} userId - The userId to check against the session's hostUserId.
 * @returns {Promise<boolean>} True if the user is the host, false otherwise.
 */
async function isSessionHost(sessionId, userId) {
    const session = await findSessionById(sessionId);
    if (!session) return false;
    return session.hostUserId.toString() === userId;
}

/**
 * Initializes all Socket.IO event handlers for the application.
 *
 * Architecture overview:
 * - JWT middleware runs before connection is accepted, sets socket.userId from token.
 * - Host-only events (spin, respin, send_reminder, spin_finished) are gated by isSessionHost().
 * - All participants can emit: join_session, build_wheel, vote, reload_wheel, ready.
 * - votingStartTimes stores server-authoritative vote start timestamps keyed by sessionId,
 *   used to sync rejoining users to the correct remaining vote time.
 *
 * @param {import("socket.io").Server} io - The Socket.IO server instance.
 */
const initSocket = (io) => {

    /**
     * In-memory store of voting round start times.
     * Key: sessionId (string), Value: Date.now() timestamp (number).
     * Used to sync the vote countdown timer for users who rejoin mid-vote.
     */
    const votingStartTimes = {};

    /**
     * JWT authentication middleware.
     * Runs before every connection is established.
     * Verifies the token passed in socket.handshake.auth.token and
     * attaches the decoded userId to socket.userId for use in all event handlers.
     * Rejects the connection with "Unauthorized" if the token is missing or invalid.
     */
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;

        if (!token) {
            return next(new Error("Unauthorized"));
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            socket.userId = decoded.sub;
            return next();
        } catch (err) {
            console.error(`Auth failed: ${err.message}`);
            return next(new Error("Unauthorized"));
        }
    });

    io.on("connection", (socket) => {

        console.log(`✅ Socket connected: ${socket.id} | userId: ${socket.userId}`);

        /**
         * Fires when a socket disconnects for any reason.
         * Logs the socket ID and disconnect reason for debugging.
         * Common reasons: "transport close" (tab closed / network lost),
         * "ping timeout" (client stopped responding), "server namespace disconnect".
         */
        socket.on("disconnect", (reason) => {
            console.log(`❌ Socket disconnected: ${socket.id} | userId: ${socket.userId} | reason: ${reason}`);
        });

        /**
         * Joins the socket to a session room identified by sessionCode.
         * If the session is currently in a "voting" state (mid-spin result),
         * sends the current spin state and voting start time to the rejoining user
         * so they can sync their UI without missing the event.
         *
         * @param {string} sessionCode - The human-readable session room identifier.
         */
        socket.on("join_session", async ({ sessionCode }) => {
            socket.join(sessionCode);

            try {
                const session = await findSessionByCode(sessionCode);
                if (!session) return;

                if (session.status === "voting" && session.currentWheelResult?.placeId) {
                    socket.emit("spin", {
                        prizeNumber: null,
                        placeId: session.currentWheelResult.placeId,
                        finalSpin: session.finalSpin || false,
                        spinRoundId: session.spinRoundId || null,
                    });

                    // Send the server-authoritative vote start time so the
                    // rejoining user's countdown timer syncs with everyone else.
                    const startTime = votingStartTimes[session._id.toString()];
                    if (startTime) {
                        socket.emit("voting_start_time", { startTime });
                    }
                }
            } catch (error) {
                console.error("Failed to send session state on join:", error);
            }
        });

        /**
         * Broadcasts to all users in the session that the wheel has been built
         * and is ready to display. Open to all participants — no host check required.
         *
         * @param {string} sessionCode - The session room to broadcast to.
         */
        socket.on("build_wheel", ({ sessionCode }) => {
            io.to(sessionCode).emit("wheel_built");
        });

        /**
         * HOST ONLY — Broadcasts the spin event to all users in the session,
         * triggering the wheel animation to start on every client.
         * Verifies the emitter is the session host before broadcasting.
         *
         * @param {string} sessionCode - The session room to broadcast to.
         * @param {number} prizeNumber - The wheel segment index the wheel will land on.
         * @param {string} placeId - The Google Places ID of the selected restaurant.
         * @param {boolean} finalSpin - Whether this is the final deciding spin.
         * @param {string} sessionId - The MongoDB session ID (used for host verification).
         * @param {string} spinRoundId - Unique ID for this spin round (used to prevent duplicate restores).
         */
        socket.on("spin", async ({ sessionCode, prizeNumber, placeId, finalSpin, sessionId, spinRoundId }) => {
            try {
                const hostCheck = await isSessionHost(sessionId, socket.userId);
                if (!hostCheck) {
                    console.warn(`Unauthorized spin attempt by userId: ${socket.userId}`);
                    return;
                }

                io.to(sessionCode).emit("spin", {
                    prizeNumber,
                    placeId,
                    finalSpin,
                    spinRoundId,
                });
            } catch (error) {
                console.error("Failed to verify host for spin:", error);
            }
        });

        /**
         * Broadcasts updated vote counts to all users in the session
         * after a participant submits their vote.
         * Fetches the latest counts from the database as the source of truth.
         * Open to all participants — no host check required.
         *
         * @param {string} sessionCode - The session room to broadcast to.
         * @param {string} sessionId - The MongoDB session ID to fetch vote counts from.
         */
        socket.on("vote", async ({ sessionCode, sessionId }) => {
            try {
                const session = await findSessionById(sessionId);
                const { acceptCount, respinCount } = session.voteSummary;

                io.to(sessionCode).emit("vote_update", {
                    acceptCount: acceptCount || 0,
                    respinCount: respinCount || 0,
                });
            } catch (error) {
                console.error("Failed to get vote counts:", error);
            }
        });

        /**
         * HOST ONLY — Broadcasts the respin decision to all users after the
         * voting timer expires. Tells clients whether to respin the wheel or
         * proceed to the result page.
         * Verifies the emitter is the session host before broadcasting.
         *
         * @param {string} sessionCode - The session room to broadcast to.
         * @param {boolean} isrespin - True if the majority voted to respin.
         * @param {boolean} finalSpin - True if the next spin is the final deciding spin.
         * @param {string} sessionId - The MongoDB session ID (used for host verification).
         */
        socket.on("respin", async ({ sessionCode, isrespin, finalSpin, sessionId }) => {
            try {
                const hostCheck = await isSessionHost(sessionId, socket.userId);
                if (!hostCheck) {
                    console.warn(`Unauthorized respin attempt by userId: ${socket.userId}`);
                    return;
                }
                io.to(sessionCode).emit("respin_update", { isrespin, finalSpin });
            } catch (error) {
                console.error("Failed to verify host for respin:", error);
            }
        });

        /**
         * Broadcasts to all users in the session that the wheel items have been
         * reloaded (e.g. after a respin removes the previous result from the pool).
         * Open to all participants — no host check required.
         *
         * @param {string} sessionCode - The session room to broadcast to.
         */
        socket.on("reload_wheel", ({ sessionCode }) => {
            io.to(sessionCode).emit("wheel_reloaded");
        });

        /**
         * Broadcasts updated ready status to all users in the session
         * after a participant marks themselves as ready.
         * Open to all participants — no host check required.
         *
         * @param {string} sessionCode - The session room to broadcast to.
         * @param {string} sessionId - The MongoDB session ID to fetch participant ready status from.
         */
        socket.on("ready", async ({ sessionCode, sessionId }) => {
            try {
                const session = await findSessionById(sessionId);
                const { participants } = session;
                const readyCount = participants.filter(p => p.isReady).length;
                const totalParticipants = participants.length;
                const allReady = readyCount === totalParticipants;

                io.to(sessionCode).emit("ready_update", {
                    readyCount,
                    totalParticipants,
                    allReady,
                    participants,
                });
            } catch (error) {
                console.error("Failed to get ready status:", error);
            }
        });

        /**
         * HOST ONLY — Sends a reminder notification to all users in the session,
         * including the list of userIds who have not yet marked themselves as ready.
         * Each client checks if their own userId is in the list and shows a popup if so.
         * Verifies the emitter is the session host before broadcasting.
         *
         * @param {string} sessionCode - The session room to broadcast to.
         * @param {string} sessionId - The MongoDB session ID (used for host verification and fetching participants).
         */
        socket.on("send_reminder", async ({ sessionCode, sessionId }) => {
            try {
                const hostCheck = await isSessionHost(sessionId, socket.userId);
                if (!hostCheck) {
                    console.warn(`Unauthorized reminder attempt by userId: ${socket.userId}`);
                    return;
                }

                const session = await findSessionById(sessionId);
                const remindedUserIds = session.participants
                    .filter(p => !p.isReady)
                    .map(p => p.userId.toString());

                io.to(sessionCode).emit("reminder_sent", remindedUserIds);
            } catch (error) {
                console.error("Failed to send reminder:", error);
            }
        });

        /**
         * HOST ONLY — Broadcasts the authoritative spin result to all users
         * after the wheel animation completes on the host's client.
         * Generates a server-side timestamp as the source of truth for the
         * voting countdown timer, stored in votingStartTimes for rejoining users.
         * Verifies the emitter is the session host before broadcasting.
         *
         * @param {string} sessionCode - The session room to broadcast to.
         * @param {Object} result - The winning wheel item (name, placeId, rating, etc.).
         * @param {boolean} finalSpin - Whether this was the final spin; if true, no vote timer is started.
         * @param {string} sessionId - The MongoDB session ID (used for host verification and timer storage).
         */
        socket.on("spin_finished", async ({ sessionCode, result, finalSpin, sessionId }) => {
            try {
                const hostCheck = await isSessionHost(sessionId, socket.userId);
                if (!hostCheck) {
                    console.warn(`Unauthorized spin_finished attempt by userId: ${socket.userId}`);
                    return;
                }

                // Generate server-authoritative timestamp so all clients share
                // the same vote countdown start time regardless of network latency.
                const startTime = Date.now();

                if (!finalSpin) {
                    votingStartTimes[sessionId] = startTime;
                }

                io.to(sessionCode).emit("spin_finished", {
                    result,
                    finalSpin,
                    startTime,
                });
            } catch (error) {
                console.error("Failed to verify host for spin_finished:", error);
            }
        });
    });
};

module.exports = { initSocket };
