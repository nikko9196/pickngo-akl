const { getUniquePlaceIds } = require("../utils/wheelUtils");

// Test: getUniquePlaceIds
describe("getUniquePlaceIds", () => {
  test("Returns unique place IDs", () => {
    const result = getUniquePlaceIds([
      { placeId: "p1" },
      { placeId: "p2" },
      { placeId: "p3" },
    ]);

    expect(result).toEqual(["p1", "p2", "p3"]);
  });

  test("Removes duplicated place IDs", () => {
    const result = getUniquePlaceIds([
      { placeId: "p1" },
      { placeId: "p1" },
      { placeId: "p2" },
    ]);

    expect(result).toEqual(["p1", "p2"]);
  });

  test("Returns empty array when wheelItems is empty", () => {
    expect(getUniquePlaceIds([])).toEqual([]);
  });
});
