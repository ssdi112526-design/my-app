import { Link } from "react-router-dom";
import { FiBriefcase, FiUserPlus } from "react-icons/fi";
import "../../styles/auth.css";
import "../../styles/users.css";

export default function ApkRegisterHub() {
  return (
    <div className="auth-container">
      <div className="auth-card apk-register-hub" style={{ maxWidth: 560, width: "100%" }}>
        <h2>Get started with Fast Recovery</h2>
        <p className="muted">
          Install the APK and register here. New companies need SSDI approval after
          payment (offline or online). Agents join with a company code from their
          repo admin.
        </p>

        <div className="apk-register-options">
          <Link to="/register-company" className="apk-register-option">
            <span className="apk-register-option__icon">
              <FiBriefcase aria-hidden />
            </span>
            <div>
              <strong>Register a new company</strong>
              <p>
                Create your repo company and admin account. Status stays pending
                until payment is confirmed and SSDI activates you.
              </p>
            </div>
          </Link>

          <Link to="/agent-register" className="apk-register-option">
            <span className="apk-register-option__icon">
              <FiUserPlus aria-hidden />
            </span>
            <div>
              <strong>Join as repo user / agent</strong>
              <p>
                Use the company code from your repo admin. Your account stays
                inactive until the admin activates you.
              </p>
            </div>
          </Link>
        </div>

        <p className="auth-link" style={{ marginTop: 20 }}>
          <Link to="/">← Back to login portal</Link>
        </p>
      </div>
    </div>
  );
}
