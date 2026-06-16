import { FiStar } from "react-icons/fi";

/** Interactive or read-only star rating (1–5). */
export default function StarRating({
  value = 0,
  onChange,
  readOnly = false,
  size = "md",
  label,
}) {
  const stars = [1, 2, 3, 4, 5];
  const sizeClass =
    size === "sm" ? "star-rating--sm" : size === "lg" ? "star-rating--lg" : "";

  return (
    <div
      className={`star-rating ${sizeClass}${readOnly ? " star-rating--readonly" : ""}`}
      role={readOnly ? "img" : "radiogroup"}
      aria-label={label || `Rating: ${value} out of 5`}
    >
      {label && !readOnly ? (
        <span className="star-rating__label">{label}</span>
      ) : null}
      <div className="star-rating__stars">
        {stars.map((star) => {
          const filled = star <= value;
          if (readOnly) {
            return (
              <span
                key={star}
                className={`star-rating__star${filled ? " is-filled" : ""}`}
                aria-hidden
              >
                <FiStar />
              </span>
            );
          }
          return (
            <button
              key={star}
              type="button"
              className={`star-rating__star${filled ? " is-filled" : ""}`}
              onClick={() => onChange?.(star)}
              aria-label={`${star} star${star > 1 ? "s" : ""}`}
              aria-pressed={value === star}
            >
              <FiStar />
            </button>
          );
        })}
      </div>
    </div>
  );
}
