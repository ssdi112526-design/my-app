import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiCheckCircle, FiLoader, FiSmartphone } from "react-icons/fi";
import useAuth from "../../../hooks/useAuth";
import { repoUserService } from "../../../services/repoUser.service";
import { REPO_ROLE_OPTIONS } from "../../../constants/repoRoles";
import BloodGroupPicker from "../../../components/userProfile/BloodGroupPicker";
import StateCombobox from "../../../components/userProfile/StateCombobox";
import ManualDobFields from "../../../components/common/ManualDobFields";
import {
  partsToDobIso,
  validateDobParts,
} from "../../../utils/dateOfBirthUtils";
import "../../../styles/users.css";
import "../../../styles/profile.css";

const DEV_FIXED_OTP = "123456";

async function lookupPincode(pin) {
  const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
  const data = await res.json();
  const block = Array.isArray(data) ? data[0] : null;

  if (block?.Status !== "Success" || !block.PostOffice?.length) {
    return null;
  }

  const office = block.PostOffice[0];
  return {
    city: office.District || office.Name || "",
    state: office.State || "",
    area: office.Name || "",
  };
}

export default function CreateUser() {
  const navigate = useNavigate();
  const { auth } = useAuth();

  const [form, setForm] = useState({
    name: "",
    fatherName: "",
    email: "",
    dateOfBirth: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    bloodGroup: "",
    password: "",
    role: "OFFICE_STAFF",
  });

  const [dobParts, setDobParts] = useState({ day: "", month: "", year: "" });

  const [otp, setOtp] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState("");
  const [otpMessage, setOtpMessage] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pincodeStatus, setPincodeStatus] = useState({ type: "idle", message: "" });
  const [eligibility, setEligibility] = useState(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(true);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let next = value;

    if (name === "pincode") {
      next = value.replace(/\D/g, "").slice(0, 6);
    }

    setForm((prev) => ({
      ...prev,
      [name]: next,
    }));

    if (name === "phone") {
      setPhoneVerified(false);
      setOtpSent(false);
      setOtp("");
      setDevOtpHint("");
      setOtpMessage("");
    }

    if (name === "pincode" && next.length < 6) {
      setPincodeStatus({ type: "idle", message: "" });
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await repoUserService.getConnectEligibility(auth.token);
        if (!cancelled) setEligibility(res?.data || null);
      } catch {
        if (!cancelled) setEligibility(null);
      } finally {
        if (!cancelled) setEligibilityLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth.token]);

  useEffect(() => {
    const pin = form.pincode.replace(/\D/g, "");
    if (pin.length !== 6) return undefined;

    let cancelled = false;
    setPincodeStatus({ type: "loading", message: "Looking up pincode…" });

    const timer = setTimeout(async () => {
      try {
        const result = await lookupPincode(pin);
        if (cancelled) return;

        if (!result) {
          setPincodeStatus({
            type: "error",
            message: "Pincode not found. Enter city and state manually.",
          });
          return;
        }

        setForm((prev) => ({
          ...prev,
          city: result.city || prev.city,
          state: result.state || prev.state,
        }));
        setPincodeStatus({
          type: "success",
          message: result.area
            ? `Auto-filled from ${result.area}, ${result.state}`
            : `Auto-filled: ${result.city}, ${result.state}`,
        });
      } catch {
        if (!cancelled) {
          setPincodeStatus({
            type: "error",
            message: "Could not fetch pincode details. Fill city and state manually.",
          });
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.pincode]);

  const handleDobChange = (parts) => {
    setDobParts(parts);
    setForm((prev) => ({
      ...prev,
      dateOfBirth: partsToDobIso(parts),
    }));
  };

  const applySendOtpSuccess = () => {
    setOtpSent(true);
    setPhoneVerified(false);
    setOtp("");
    setOtpMessage(`Enter OTP ${DEV_FIXED_OTP} below (test mode).`);
    setDevOtpHint(`Your OTP is: ${DEV_FIXED_OTP}`);
    setError("");
  };

  const handleSendOtp = async () => {
    if (!form.phone.trim()) {
      setError("Enter mobile number first.");
      return;
    }

    setSendingOtp(true);
    setError("");
    setOtpMessage("");

    try {
      const res = await repoUserService.sendPhoneOtp(form.phone.trim(), auth.token);
      setOtpSent(true);
      setPhoneVerified(false);
      setOtp("");
      setOtpMessage(res?.message || `Enter OTP ${DEV_FIXED_OTP} below.`);
      setDevOtpHint(`Your OTP is: ${res?.data?.devOtp || DEV_FIXED_OTP}`);
      setError("");
    } catch {
      applySendOtpSuccess();
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      setError("Enter the OTP you received.");
      return;
    }

    if (otp.trim() !== DEV_FIXED_OTP) {
      setError(`Enter the test OTP: ${DEV_FIXED_OTP}`);
      return;
    }

    setVerifyingOtp(true);
    setError("");

    try {
      const res = await repoUserService.verifyPhoneOtp(
        form.phone.trim(),
        otp.trim(),
        auth.token
      );
      setPhoneVerified(true);
      setOtpMessage(res?.message || "Mobile number verified.");
      setDevOtpHint("");
    } catch {
      setPhoneVerified(true);
      setOtpMessage(`Verified with test OTP ${DEV_FIXED_OTP}.`);
      setDevOtpHint("");
      setError("");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.bloodGroup) {
      setError("Please select a blood group.");
      return;
    }

    if (!form.state.trim()) {
      setError("Please select a state.");
      return;
    }

    const dobError = validateDobParts(dobParts);
    if (dobError) {
      setError(dobError);
      return;
    }

    if (!phoneVerified) {
      setError("Please verify the mobile number with OTP before creating the user.");
      return;
    }

    if (eligibility && !eligibility.allowed) {
      setError(eligibility.reason || "You cannot connect more users on your current plan.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await repoUserService.createUser(
        {
          ...form,
          dateOfBirth: partsToDobIso(dobParts),
        },
        auth.token
      );
      alert("Repo user created successfully");
      navigate("/users");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page create-company-page repo-form-page profile-page">
      <div className="create-company-header">
        <div>
          <h2>Create Repo User</h2>
          <p className="muted">
            Add team leader, head office staff, or office staff. Enter pincode to
            auto-fill city and state.
          </p>
        </div>
        <button
          type="button"
          className="secondary-page-btn"
          onClick={() => navigate("/users")}
        >
          Back to Users
        </button>
      </div>

      <form className="create-company-form" onSubmit={handleSubmit}>
        {!eligibilityLoading && eligibility && (
          <div
            className={`create-company-card plan-usage-banner${
              !eligibility.allowed ? " is-blocked" : ""
            }`}
          >
            <h3>Plan: {eligibility.tierName}</h3>
            {eligibility.maxUsers != null ? (
              <p className="muted">
                Connected users: {eligibility.connectedCount} / {eligibility.maxUsers}
                {eligibility.remainingUsers != null &&
                  ` (${eligibility.remainingUsers} remaining)`}
              </p>
            ) : (
              <p className="muted">
                Connected users: {eligibility.connectedCount}
                {eligibility.requiresConnectFee &&
                  ` · ₹${eligibility.connectFeeAmount} one-time fee per new user`}
              </p>
            )}
            {!eligibility.allowed && (
              <p className="form-error-inline">{eligibility.reason}</p>
            )}
            {eligibility.requiresConnectFee && eligibility.allowed && (
              <p className="muted">
                Connect fee is disabled in test mode — you can create users without payment.
              </p>
            )}
          </div>
        )}

        <div className="create-company-card">
          <section className="create-company-section" aria-labelledby="create-user-personal">
            <header className="create-company-section__head" id="create-user-personal">
              <h3>Personal details</h3>
            </header>
            <div className="form-grid two-column">
              <div className="form-group">
                <label htmlFor="name">Full name *</label>
                <input
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="fatherName">Father&apos;s name *</label>
                <input
                  id="fatherName"
                  name="fatherName"
                  value={form.fatherName}
                  onChange={handleChange}
                  placeholder="Father's name"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="user@company.com"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="role">Role *</label>
                <select id="role" name="role" value={form.role} onChange={handleChange}>
                  {REPO_ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group full-width">
                <label>Blood group *</label>
                <BloodGroupPicker
                  value={form.bloodGroup}
                  onChange={(bloodGroup) =>
                    setForm((prev) => ({ ...prev, bloodGroup }))
                  }
                  required
                />
              </div>

              <div className="form-grid two-column profile-contact-grid full-width">
                <div className="form-group form-group--dob">
                  <label htmlFor="create-user-dob-day">Date of birth *</label>
                  <ManualDobFields
                    value={form.dateOfBirth}
                    onChange={handleDobChange}
                    idPrefix="create-user-dob"
                  />
                  <p className="field-hint muted">Format: DD / MM / YYYY</p>
                </div>

                <div className="form-group">
                  <label htmlFor="password">Password *</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Minimum 6 characters"
                    minLength={6}
                    required
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="create-company-section" aria-labelledby="create-user-address">
            <header className="create-company-section__head" id="create-user-address">
              <h3>Address</h3>
            </header>
            <div className="form-grid two-column">
              <div className="form-group full-width">
                <label htmlFor="address">Address *</label>
                <input
                  id="address"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="House no., street, area"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="pincode">Pincode *</label>
                <input
                  id="pincode"
                  name="pincode"
                  value={form.pincode}
                  onChange={handleChange}
                  placeholder="6-digit pincode"
                  inputMode="numeric"
                  maxLength={6}
                  required
                />
                {pincodeStatus.type !== "idle" && (
                  <p
                    className={`pincode-lookup-hint pincode-lookup-hint--${pincodeStatus.type}`}
                  >
                    {pincodeStatus.type === "loading" && (
                      <FiLoader className="pincode-spin" aria-hidden />
                    )}
                    {pincodeStatus.message}
                  </p>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="city">City *</label>
                <input
                  id="city"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="City"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="state">State *</label>
                <StateCombobox
                  id="state"
                  value={form.state}
                  onChange={(state) => setForm((prev) => ({ ...prev, state }))}
                  required
                />
              </div>
            </div>
          </section>

          <section
            className="create-company-section create-company-section--last phone-otp-section"
            aria-labelledby="create-user-mobile"
          >
            <header className="create-company-section__head phone-otp-card-head" id="create-user-mobile">
              <FiSmartphone size={22} aria-hidden />
              <div>
                <h3>Mobile verification</h3>
                <p className="muted profile-section-desc">
                  Send OTP, then enter <strong>{DEV_FIXED_OTP}</strong> (test OTP — no SMS).
                </p>
              </div>
            </header>

            <div className="form-grid two-column">
            <div className="form-group">
              <label htmlFor="phone">Mobile number</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                placeholder="10-digit mobile number"
                required
              />
            </div>

            <div className="form-group phone-otp-actions">
              <label>&nbsp;</label>
              <button
                type="button"
                className="company-btn company-btn--reset"
                onClick={handleSendOtp}
                disabled={sendingOtp || !form.phone.trim()}
              >
                {sendingOtp ? "Sending OTP..." : "Send OTP"}
              </button>
            </div>
          </div>

          {otpSent && !phoneVerified && (
            <div className="phone-otp-verify-row">
              <div className="form-group">
                <label htmlFor="otp">Enter OTP</label>
                <input
                  id="otp"
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit OTP"
                />
              </div>
              <button
                type="button"
                className="company-btn company-btn--view"
                onClick={handleVerifyOtp}
                disabled={verifyingOtp || otp.length < 6}
              >
                {verifyingOtp ? "Verifying..." : "Verify OTP"}
              </button>
            </div>
          )}

          {otpMessage && (
            <p className={`phone-otp-message${phoneVerified ? " success" : ""}`}>
              {otpMessage}
            </p>
          )}

          {devOtpHint && <p className="phone-otp-dev-hint">{devOtpHint}</p>}

          {phoneVerified && (
            <p className="phone-otp-verified">
              <FiCheckCircle aria-hidden />
              Mobile number verified — you can create the user now.
            </p>
          )}
          </section>
        </div>

        {error && <p className="error-text create-company-error">{error}</p>}

        <div className="create-company-actions create-company-actions--sticky">
          <button
            type="submit"
            className="primary-page-btn"
            disabled={loading || !phoneVerified}
          >
            {loading ? "Creating..." : "Create User"}
          </button>
        </div>
      </form>
    </div>
  );
}
