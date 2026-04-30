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

        socket.on("spin", async ({ sessionCode, prizeNumber }) => {
            io.to(sessionCode).emit("spin", { prizeNumber });
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

        socket.on("respin", ({ sessionCode, isrespin }) => {
            io.to(sessionCode).emit("respin_update", isrespin);
        });

        socket.on("reload_wheel", ({ sessionCode }) => {
          io.to(sessionCode).emit("wheel_reloaded");
        });

        socket.on("disconnect", () => {
            console.log(`user ${socket.userid} disconnected`);
        });
    });
};

module.exports = { initSocket };