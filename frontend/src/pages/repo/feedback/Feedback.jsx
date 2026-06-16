import { useState } from "react";
import useAuth from "../../../hooks/useAuth";
import feedbackService from "../../../services/feedback.service";
import StarRating from "../../../components/common/StarRating";
import "../../../styles/feedback.css";

export default function Feedback() {
  const { auth } = useAuth();
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!auth?.token) return;

    const text = message.trim();
    if (!rating) {
      setError("Please select a star rating.");
      return;
    }
    if (!text) {
      setError("Please enter your message.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");
      await feedbackService.create({ rating, message: text }, auth.token);
      setRating(0);
      setMessage("");
      setSuccess("Thank you — your feedback was sent.");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="content feedback-page">
      <header className="feedback-page__header">
        <h2>Feedback</h2>
        <p>Rate your experience and share a short message.</p>
      </header>

      <section className="feedback-card" aria-label="Submit feedback">
        <form className="feedback-form" onSubmit={handleSubmit}>
          <StarRating
            value={rating}
            onChange={setRating}
            size="lg"
            label="Your rating"
          />

          <div className="feedback-form__message">
            <label>
              Message
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your feedback here…"
                maxLength={5000}
                disabled={submitting}
                required
              />
            </label>
          </div>

          {error && <p className="error-text">{error}</p>}
          {success && <p className="feedback-success">{success}</p>}

          <button
            type="submit"
            className="feedback-submit-btn"
            disabled={submitting}
          >
            {submitting ? "Sending…" : "Send feedback"}
          </button>
        </form>
      </section>
    </div>
  );
}
