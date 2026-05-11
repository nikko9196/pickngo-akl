const { findSessionById, findSessionByCode } = require('../services/sessionService');
const jwt = require("jsonwebtoken");

// Helper to check if a userId is the host of a session
async function isSessionHost(sessionId, userId) {
    const session = await findSessionById(sessionId);
    if (!session) return false;
    console.log("isHost:", session.hostUserId.toString() === userId);
    return session.hostUserId.toString() === userId;
}

const initSocket = (io) => {
    const votingStartTimes = {}; 
    io.on("connection", (socket) => {

        socket.on("join_session", async ({ sessionCode, userId }) => {
            if (!userId) {
                console.warn("join_session missing userId");
                return;
            }

            socket.join(sessionCode);
            socket.userId = userId;
        
            try {
                const session = await findSessionByCode(sessionCode);
                if (!session) return;
        
                // if wheel is mid-spin, send current spin state to the rejoining user
                if (session.status === "voting" && session.currentWheelResult?.placeId) {
                    socket.emit("spin", {
                        prizeNumber: null,
                        placeId: session.currentWheelResult.placeId,
                        finalSpin: session.finalSpin || false,
                        spinRoundId: session.spinRoundId || null, 
                    });

                    // send the voting start time so rejoining users sync their timer
                    const startTime = votingStartTimes[session._id?.toString()];
                    if (startTime) {
                        socket.emit("voting_start_time", { startTime });
                    }
                }
            } catch (error) {
                console.error("Failed to send session state on join:", error);
            }
        });

        socket.on("build_wheel", ({ sessionCode }) => {
          io.to(sessionCode).emit("wheel_built");
        });

        // Host-only: spin
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

        // Host-only: respin decision
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

        socket.on("reload_wheel", ({ sessionCode }) => {
          io.to(sessionCode).emit("wheel_reloaded");
        });

        socket.on("disconnect", () => {
            console.log(`user ${socket.userId} disconnected`);
        });

        socket.on("ready", async ({ sessionCode, sessionId }) => {
          try {
              const session = await findSessionById(sessionId);
      
              const participants = session.participants;
      
              const readyCount = participants.filter(p => p.isReady).length;
              const totalParticipants = participants.length;
      
              const allReady = readyCount === totalParticipants;
      
              io.to(sessionCode).emit("ready_update", {
                  readyCount,
                  totalParticipants,
                  allReady,
                  participants
              });
      
          } catch (error) {
              console.error("Failed to get ready status:", error);
          }
        });

        // Host-only: send reminder
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

        // Host-only: final wheel result
        socket.on("spin_finished", async ({ 
            sessionCode,
            result,
            finalSpin,
            sessionId
        }) => {

            try {

                const hostCheck = await isSessionHost(
                    sessionId,
                    socket.userId
                );

                if (!hostCheck) {
                    console.warn(
                        `Unauthorized spin_finished attempt by userId: ${socket.userId}`
                    );
                    return;
                }

                // authoritative timestamp from server
                const startTime = Date.now();

                if (!finalSpin) {
                    votingStartTimes[sessionId] = startTime; 
                }

                io.to(sessionCode).emit("spin_finished", {
                    result,
                    finalSpin,
                    startTime
                });

            } catch (error) {
                console.error(
                    "Failed to verify host for spin_finished:",
                    error
                );
            }
        });
    });
};

module.exports = { initSocket };