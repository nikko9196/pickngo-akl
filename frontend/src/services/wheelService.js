const BASE_URL = import.meta.env.VITE_API_BASE_URL;

const getVoteCounts = async (sessionid, spin_no) => {
  const response = await fetch(`${BASE_URL}/api/decision/${sessionid}/${spin_no}`);
  const data = await response.json();

  return Object.fromEntries(
    data.map(item => [item.decision, Number(item.count)])
  );
};

export const ifRespin = async (sessionid, spin_no) => {
  const counts = await getVoteCounts(sessionid, spin_no);
  return (counts.respin || 0) >= (counts.happy || 0);
};

export const countVote = async (sessionid, spin_no) => {
  const counts = await getVoteCounts(sessionid, spin_no);
  return [counts.respin || 0, counts.happy || 0];
};

export const getHost = async (sessionid, userid) => {
    const response = await fetch(`${BASE_URL}/api/host/${sessionid}/${userid}`);
    const data = await response.json();
    
    return data.length > 0;
  };
