// import { pool } from './db_test.js';

// export const selectUserDecision = async (data) => {
//     const { sessionid, spin_no } = data;
  
//     const query = `
//       SELECT COUNT(userid), decision 
//       FROM pickngo_userspin 
//       WHERE sessionid = $1 AND spin_no = $2 
//       GROUP BY decision
//     `;
  
//     const result = await pool.query(query, [sessionid, spin_no]);
  
//     return result.rows || [];
//   };

// export const selectHost = async (data) => {
//     const { sessionid, userid } = data;
  
//     const query = `
//         select distinct h.userid, h.sessionid from pickngo_userspin u
//         inner join pickngo_host h on h.sessionid = u.sessionid
//         where h.sessionid = $1 and h.userid = $2
//     `;
  
//     const result = await pool.query(query, [sessionid, userid]);
  
//     return result.rows || [];
//   };

const { pool } = require('./db_test.js');

const selectUserDecision = async (data) => {
    const { sessionid, spin_no } = data;
  
    const query = `
      SELECT COUNT(userid), decision 
      FROM pickngo_userspin 
      WHERE sessionid = $1 AND spin_no = $2 
      GROUP BY decision
    `;
  
    const result = await pool.query(query, [sessionid, spin_no]);
  
    return result.rows || [];
};

const selectHost = async (data) => {
    const { sessionid, userid } = data;
  
    const query = `
        select distinct h.userid, h.sessionid from pickngo_userspin u
        inner join pickngo_host h on h.sessionid = u.sessionid
        where h.sessionid = $1 and h.userid = $2
    `;
  
    const result = await pool.query(query, [sessionid, userid]);
  
    return result.rows || [];
};

module.exports = { selectUserDecision, selectHost };