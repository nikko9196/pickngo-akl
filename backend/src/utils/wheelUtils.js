function getUniquePlaceIds(wheelItems) {
  return [...new Set(wheelItems.map((item) => item.placeId))];
}

module.exports = {
  getUniquePlaceIds,
};
