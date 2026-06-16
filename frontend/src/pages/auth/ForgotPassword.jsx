import { useNavigate } from "react-router-dom";
import "../../styles/auth.css";

export default function ForgotPassword() {
  const navigate = useNavigate();

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Forgot Password</h2>
        <p className="auth-info">
          Password reset feature is not connected yet.
          For now, please contact SSDI admin or your repo admin to reset your password.
        </p>

        <button className="auth-button" onClick={() => navigate("/")}>
          Back to Login Portal
        </button>
      </div>
    </div>
  );
}