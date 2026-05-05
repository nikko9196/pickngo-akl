function cuisineFlag(cuisine) {
  const flags = {
    Japanese: "🇯🇵",
    Korean: "🇰🇷",
    Chinese: "🇨🇳",
    Thai: "🇹🇭",
    Italian: "🇮🇹",
    Indian: "🇮🇳",
    "Modern NZ": "🇳🇿",
    Vietnamese: "🇻🇳",
    Mexican: "🇲🇽",
    French: "🇫🇷",
    Greek: "🇬🇷",
    Spanish: "🇪🇸",
    Lebanese: "🇱🇧",
    Turkish: "🇹🇷",
    Malaysian: "🇲🇾",
    Indonesian: "🇮🇩",
    Filipino: "🇵🇭",
    American: "🇺🇸",
    British: "🇬🇧",
  };

  return flags[cuisine] || "🍽️";
}

function formatDistance(distanceKm) {
  if (distanceKm == null) {
    return "";
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }

  return `${distanceKm.toFixed(1)}km`;
}

function formatPrice(priceLevel) {
  if (!priceLevel || priceLevel < 1) {
    return "-";
  }

  return "$".repeat(priceLevel);
}

function RestaurantCard({ item, isSelected, isDisabled, onToggle }) {
  const primaryCuisine = item.cuisine?.[0] || "Restaurant";
  const districtText = item.district || item.address?.split(",")[1]?.trim() || "";

  function handleClick() {
    if (isDisabled) {
      return;
    }

    onToggle(item.placeId);
  }

  return (
    <article
      className={`restaurant-card${isSelected ? " restaurant-card-selected" : ""}${
        isDisabled ? " restaurant-card-disabled" : ""
      }`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="restaurant-card-photo">
        {item.photos?.[0] ? (
          <img src={item.photos[0]} alt={item.name} loading="lazy" />
        ) : (
          <div className="restaurant-card-photo-fallback">No image</div>
        )}
      </div>

      <div className="restaurant-card-info">
        <h3 className="restaurant-card-name">{item.name}</h3>

        <div className="restaurant-card-row restaurant-card-row-fixed">
          <span className="restaurant-card-cuisine">
            <span aria-hidden="true">{cuisineFlag(primaryCuisine)}</span>{" "}
            {primaryCuisine}
          </span>
          <span className="restaurant-card-rating">
            <span aria-hidden="true">⭐</span> {item.rating?.toFixed(1) || "-"}
          </span>
        </div>

        <div className="restaurant-card-row">
          <span className="restaurant-card-location">
            <span aria-hidden="true">📍</span>
            <span className="restaurant-card-district">{districtText}</span>
            {item.distance != null ? (
              <>
                <span className="restaurant-card-bullet"> • </span>
                <span className="restaurant-card-distance">
                  {formatDistance(item.distance)}
                </span>
              </>
            ) : null}
          </span>
        </div>

        <div className="restaurant-card-row">
          <span className="restaurant-card-price">
            <span aria-hidden="true">💰</span> {formatPrice(item.priceLevel)}
          </span>
        </div>
      </div>

      <div className="restaurant-card-checkbox" aria-hidden="true">
        <div className="restaurant-card-checkbox-inner" />
      </div>
    </article>
  );
}

export default RestaurantCard;
