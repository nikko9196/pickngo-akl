import { selectUserDecision, selectHost } from "./userspinModels.js";

export const getUserDecision = async (req, res) => {
    try {
      const { sessionid, spin_no } = req.params;
  
      const result = await selectUserDecision({ sessionid, spin_no });
  
      res.status(200).json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  export const getHost = async (req, res) => {
    try {
      const { sessionid, userid } = req.params;
  
      const result = await selectHost({ sessionid, userid });
  
      res.status(200).json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  };