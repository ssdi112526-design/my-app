import { fileAssetUrl } from "../../utils/fileAssetUrl";
import { formatRepoRole } from "../../constants/repoRoles";
import StarRating from "./StarRating";

function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/** SSDI “Recent Feedbacks” row: avatar, name + stars, then message. */
export default function FeedbackReviewCard({ feedback }) {
  const user = feedback?.userId || {};
  const company = feedback?.companyId || {};
  const photoSrc = fileAssetUrl(user.photoUrl);
  const rating = Number(feedback?.rating) || 0;
  const isAdmin = user.role === "REPO_ADMIN";

  return (
    <article className="feedback-review-item">
      <div className="feedback-review-item__avatar-wrap">
        {photoSrc ? (
          <img
            src={photoSrc}
            alt=""
            className="feedback-review-item__avatar"
          />
        ) : (
          <span className="feedback-review-item__avatar feedback-review-item__avatar--initials">
            {initials(user.name)}
          </span>
        )}
      </div>

      <div className="feedback-review-item__content">
        <div className="feedback-review-item__top">
          <div className="feedback-review-item__who">
            <strong className="feedback-review-item__name">
              {user.name || "User"}
            </strong>
            <span
              className={`feedback-review-item__meta${
                isAdmin ? " feedback-review-item__meta--admin" : ""
              }`}
            >
              {isAdmin ? "Repo Admin" : formatRepoRole(user.role)}
              {company?.companyName ? ` · ${company.companyName}` : ""}
            </span>
          </div>
          <StarRating value={rating} readOnly size="sm" />
        </div>

        <p className="feedback-review-item__message">
          {feedback?.message || feedback?.subject || "—"}
        </p>
      </div>
    </article>
  );
}
