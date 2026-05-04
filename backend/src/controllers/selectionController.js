const {
  getMySelectionsForSession,
  getSelectionsForSession,
  saveSelectionsForSession,
} = require("../services/selectionService");

function handleControllerError(error, res, fallbackMessage) {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  const message = error?.message || fallbackMessage;

  return res.status(statusCode).json({ message });
}

async function saveMySessionSelections(req, res) {
  try {
    const result = await saveSelectionsForSession({
      sessionId: req.params.sessionId,
      requesterUserId: req.userId,
      placeIds: req.body.placeIds,
    });

    return res.status(200).json(result);
  } catch (error) {
    return handleControllerError(error, res, "Failed to save restaurant selections.");
  }
}

async function getMySessionSelections(req, res) {
  try {
    const result = await getMySelectionsForSession({
      sessionId: req.params.sessionId,
      requesterUserId: req.userId,
    });

    return res.json(result);
  } catch (error) {
    return handleControllerError(error, res, "Failed to fetch your restaurant selections.");
  }
}

async function getSessionSelections(req, res) {
  try {
    const result = await getSelectionsForSession({
      sessionId: req.params.sessionId,
      requesterUserId: req.userId,
    });

    return res.json(result);
  } catch (error) {
    return handleControllerError(error, res, "Failed to fetch restaurant selections.");
  }
}

module.exports = {
  getMySessionSelections,
  getSessionSelections,
  saveMySessionSelections,
};
