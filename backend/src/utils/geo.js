function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function roundNumber(value, digits = 1) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function calculateDistanceKm(start, end) {
  if (
    !start ||
    !end ||
    !Number.isFinite(start.latitude) ||
    !Number.isFinite(start.longitude) ||
    !Number.isFinite(end.latitude) ||
    !Number.isFinite(end.longitude)
  ) {
    return null;
  }

  const earthRadiusKm = 6371;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRadians(end.latitude - start.latitude);
  const dLon = toRadians(end.longitude - start.longitude);
  const lat1 = toRadians(start.latitude);
  const lat2 = toRadians(end.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return roundNumber(earthRadiusKm * c, 1);
}

function averageCoordinates(points) {
  if (!Array.isArray(points) || points.length === 0) {
    return null;
  }

  const validPoints = points.filter(
    (point) =>
      point &&
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude)
  );

  if (validPoints.length === 0) {
    return null;
  }

  const totals = validPoints.reduce(
    (current, point) => ({
      latitude: current.latitude + point.latitude,
      longitude: current.longitude + point.longitude,
    }),
    { latitude: 0, longitude: 0 }
  );

  return {
    latitude: roundNumber(totals.latitude / validPoints.length, 6),
    longitude: roundNumber(totals.longitude / validPoints.length, 6),
  };
}

module.exports = {
  averageCoordinates,
  calculateDistanceKm,
  clampNumber,
  roundNumber,
};
