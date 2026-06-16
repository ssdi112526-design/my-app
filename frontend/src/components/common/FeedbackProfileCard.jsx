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

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "";
  }
}

/** Profile-style feedback row: photo (if uploaded), stars, then message. */
export default function FeedbackProfileCard({ feedback, showCompany = false }) {
  const user = feedback?.userId || {};
  const company = feedback?.companyId || {};
  const photoSrc = fileAssetUrl(user.photoUrl);
  const rating = Number(feedback?.rating) || 0;
  const isAdmin = user.role === "REPO_ADMIN";

  return (
    <article className="feedback-profile-card">
      <div className="feedback-profile-card__avatar-wrap">
        {photoSrc ? (
          <img
            src={photoSrc}
            alt=""
            className="feedback-profile-card__avatar"
          />
        ) : (
          <span className="feedback-profile-card__avatar feedback-profile-card__avatar--initials">
            {initials(user.name)}
          </span>
        )}
      </div>

      <div className="feedback-profile-card__body">
        <div className="feedback-profile-card__head">
          <div>
            <strong className="feedback-profile-card__name">
              {user.name || "User"}
            </strong>
            <span
              className={`feedback-profile-card__role${
                isAdmin ? " feedback-profile-card__role--admin" : ""
              }`}
            >
              {isAdmin ? "Repo Admin" : formatRepoRole(user.role)}
            </span>
          </div>
          <time className="feedback-profile-card__date" dateTime={feedback?.createdAt}>
            {formatDate(feedback.createdAt)}
          </time>
        </div>

        {showCompany && company.companyName ? (
          <p className="feedback-profile-card__company">
            {company.companyName}
            {company.companyCode ? ` · ${company.companyCode}` : ""}
          </p>
        ) : null}

        <StarRating value={rating} readOnly size="sm" />

        <p className="feedback-profile-card__message">
          {feedback?.message || feedback?.subject || "—"}
        </p>
      </div>
    </article>
  );
}
