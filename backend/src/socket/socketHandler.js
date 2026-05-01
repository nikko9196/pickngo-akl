const { findSessionById } = require('../services/sessionService');

const initSocket = (io) => {
    io.on("connection", (socket) => {

        socket.on("join_session", ({ sessionCode, userid }) => {
            socket.join(sessionCode);
            socket.userid = userid;
        });

        socket.on("build_wheel", ({ sessionCode }) => {        // ✅ add this
          io.to(sessionCode).emit("wheel_built");
        });

        socket.on("spin", async ({ sessionCode, prizeNumber, finalSpin }) => {
            io.to(sessionCode).emit("spin", { prizeNumber, finalSpin });
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

        socket.on("respin", ({ sessionCode, isrespin, finalSpin }) => {
            io.to(sessionCode).emit("respin_update", {isrespin, finalSpin});
        });

        socket.on("reload_wheel", ({ sessionCode }) => {
          io.to(sessionCode).emit("wheel_reloaded");
        });

        socket.on("disconnect", () => {
            console.log(`user ${socket.userid} disconnected`);
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

        socket.on("send_reminder", async ({ sessionCode, sessionId }) => {
            try {
                const session = await findSessionById(sessionId);
        
                const remindedUserIds = session.participants
                    .filter(p => !p.isReady)
                    .map(p => p.userId);
        
                io.to(sessionCode).emit("reminder_sent", {
                    remindedUserIds
                });
        
            } catch (error) {
                console.error("Failed to send reminder:", error);
            }
        });
    });
};

module.exports = { initSocket };