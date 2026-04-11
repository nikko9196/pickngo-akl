import { selectUserDecision } from '../mock-api/userspinModels.js'

export const initSocket = (io) => {
    io.on("connection", (socket) => {
  
      socket.on("join_session", ({ sessionid, userid }) => {
        socket.join(sessionid);
        socket.userid = userid;
      });
  
      socket.on("spin", async ({ sessionid, prizeNumber }) => {
        io.to(sessionid).emit("spin", { prizeNumber });
      });
  
      socket.on("vote", async ({ sessionid, spin_no, choice }) => {
        // save to DB here
        // await pool.query(
        //     `INSERT INTO pickngo_userspin (sessionid, spin_no, userid, decision) 
        //     VALUES ($1, $2, $3, $4)`,
        //     [sessionid, spin_no, socket.userid, choice]
        // );

        const counts = await selectUserDecision({sessionid, spin_no});
        io.to(sessionid).emit("vote_update", counts);
      });
  
      socket.on("respin", ({ sessionid, isrespin }) => {
        io.to(sessionid).emit("respin_update", isrespin);
      });
  
      socket.on("disconnect", () => {
        console.log(`user ${socket.userid} disconnected`);
      });
    });
  };