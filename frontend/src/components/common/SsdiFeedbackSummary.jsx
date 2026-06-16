import StarRating from "./StarRating";

const STAR_LEVELS = [5, 4, 3, 2, 1];
const LABELS = {
  5: "Five",
  4: "Four",
  3: "Three",
  2: "Two",
  1: "One",
};

export function computeFeedbackStats(feedbacks) {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  let total = 0;

  for (const fb of feedbacks) {
    const r = Number(fb.rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) continue;
    counts[r] += 1;
    sum += r;
    total += 1;
  }

  const average = total ? (sum / total).toFixed(1) : "0.0";
  const maxCount = Math.max(...STAR_LEVELS.map((l) => counts[l]), 1);

  return { counts, total, average, maxCount };
}

export default function SsdiFeedbackSummary({ feedbacks, title }) {
  const { counts, total, average, maxCount } = computeFeedbackStats(feedbacks);
  const avgNum = Number(average);

  if (!total) return null;

  return (
    <section className="ssdi-feedback-summary" aria-label={title || "Rating summary"}>
      <div className="ssdi-feedback-summary__bars">
        {STAR_LEVELS.map((level) => (
          <div key={level} className="ssdi-feedback-summary__row">
            <span className="ssdi-feedback-summary__label">{LABELS[level]}</span>
            <div className="ssdi-feedback-summary__track">
              <div
                className="ssdi-feedback-summary__fill"
                style={{ width: `${(counts[level] / maxCount) * 100}%` }}
              />
            </div>
            <span className="ssdi-feedback-summary__count">{counts[level]}</span>
          </div>
        ))}
      </div>

      <div className="ssdi-feedback-summary__score">
        <span className="ssdi-feedback-summary__average">{average}</span>
        <StarRating value={Math.round(avgNum)} readOnly size="sm" />
        <span className="ssdi-feedback-summary__total">
          {total} Rating{total === 1 ? "" : "s"}
        </span>
      </div>
    </section>
  );
}
