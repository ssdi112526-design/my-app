import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FiPlus, FiTrash2, FiUpload } from "react-icons/fi";
import useAuth from "../../../hooks/useAuth";
import companyService from "../../../services/company.service";
import planService from "../../../services/plan.service";
import {
  buildPlansUrl,
  matchPlanFromKey,
  isValidPlanId,
} from "../../../utils/planNavigation";
import { SSDI_PLANS } from "../../../constants/ssdiPlans";
import "../../../styles/users.css";
import "../../../styles/plan-picker.css";
import "../../../styles/profile.css";
import StateCombobox from "../../../components/userProfile/StateCombobox";
import ManualDobFields from "../../../components/common/ManualDobFields";
import {
  partsToDobIso,
  validateDobParts,
} from "../../../utils/dateOfBirthUtils";
import {
  AGENCY_NAME_LABEL,
  CREATE_REPOSSESSION_FIRM_AGENCY,
} from "../../../constants/companyLabels";
import { REPO_ADMIN_POST_OPTIONS } from "../../../constants/repoAdminPost";

const initialForm = {
  companyCode: "",
  companyName: "",
  email: "",
  phone: "",
  panNumber: "",
  address: "",
  gstNumber: "",
  aadhaarNumber: "",
  planId: "",
  status: "ACTIVE",
  adminPassword: "",
  adminDistrict: "",
  adminState: "",
  adminPincode: "",
  adminDateOfBirth: "",
  adminPost: "",
  secondConfirmationNumber: "",
};

const CREATE_RETURN_PATH = "/ssdi/companies/create";

export default function SsdiCreateCompany() {
  const navigate = useNavigate();
  const location = useLocation();
  const { auth } = useAuth();

  const [form, setForm] = useState(initialForm);
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeHint, setCodeHint] = useState("");
  const [error, setError] = useState("");
  const [createdCreds, setCreatedCreds] = useState(null);
  const [selectedPlanKey, setSelectedPlanKey] = useState("");
  const [directors, setDirectors] = useState([""]);
  const [companyPhotoFile, setCompanyPhotoFile] = useState(null);
  const [companyPhotoPreview, setCompanyPhotoPreview] = useState("");
  const [adminPhotoFile, setAdminPhotoFile] = useState(null);
  const [adminPhotoPreview, setAdminPhotoPreview] = useState("");
  const [dobParts, setDobParts] = useState({ day: "", month: "", year: "" });
  const companyLogoInputRef = useRef(null);
  const adminPhotoInputRef = useRef(null);

  const handleAdminDobChange = (parts) => {
    setDobParts(parts);
    setForm((prev) => ({
      ...prev,
      adminDateOfBirth: partsToDobIso(parts),
    }));
  };

  useEffect(() => {
    const loadPlans = async () => {
      try {
        setPlansLoading(true);
        const res = await planService.getTierPlans();
        const items =
          res?.data?.plans || res?.data?.data?.plans || res?.plans || [];
        setPlans(Array.isArray(items) ? items : []);
      } catch (err) {
        setPlans([]);
      } finally {
        setPlansLoading(false);
      }
    };

    if (auth?.token) {
      loadPlans();
    }
  }, [auth?.token]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const key =
      params.get("plan") ||
      location.state?.selectedPlanId ||
      "";

    if (!key || !isValidPlanId(key.toLowerCase())) {
      return;
    }

    const planKey = key.toLowerCase();
    setSelectedPlanKey(planKey);

    const matched = matchPlanFromKey(plans, planKey);
    if (matched) {
      setForm((prev) => ({ ...prev, planId: matched._id || matched.id }));
    }
  }, [location.search, location.state, plans]);

  useEffect(() => {
    const name = form.companyName.trim();

    if (name.length < 2) {
      setForm((prev) => ({ ...prev, companyCode: "" }));
      setCodeHint("");
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setCodeLoading(true);
        setCodeHint("");

        const res = await companyService.getNextCompanyCode(name, auth.token);
        const code =
          res?.data?.companyCode ||
          res?.data?.data?.companyCode ||
          res?.companyCode ||
          "";

        if (cancelled) return;

        setForm((prev) => ({ ...prev, companyCode: code }));
        const prefix = res?.data?.prefix || res?.data?.data?.prefix;
        setCodeHint(
          prefix
            ? `Auto-generated from name (${prefix} + serial from 1111)`
            : `Auto-generated from ${AGENCY_NAME_LABEL.toLowerCase()}`
        );
      } catch (err) {
        if (!cancelled) {
          setForm((prev) => ({ ...prev, companyCode: "" }));
          setCodeHint(
            err?.response?.data?.message || "Could not generate firm / agency code"
          );
        }
      } finally {
        if (!cancelled) setCodeLoading(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.companyName, auth?.token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const updateDirector = (index, value) => {
    setDirectors((prev) => prev.map((name, i) => (i === index ? value : name)));
  };

  const addDirector = () => {
    setDirectors((prev) => [...prev, ""]);
  };

  const removeDirector = (index) => {
    setDirectors((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const formatDirectorsForSave = () =>
    directors.map((name) => name.trim()).filter(Boolean).join(", ");

  const resolveAdminName = () => {
    const firstDirector = directors.map((name) => name.trim()).find(Boolean);
    return firstDirector || form.companyName.trim();
  };

  const handlePlanDropdownChange = (e) => {
    const planKey = e.target.value;
    setSelectedPlanKey(planKey);

    if (!planKey) {
      setForm((prev) => ({ ...prev, planId: "" }));
      return;
    }

    const matched = matchPlanFromKey(plans, planKey);
    setForm((prev) => ({
      ...prev,
      planId: matched?._id || matched?.id || "",
    }));
  };

  const validateForm = () => {
    if (!form.companyName.trim()) return `${AGENCY_NAME_LABEL} is required`;
    if (!form.companyCode.trim()) {
      return `Firm / agency code is being generated — enter ${AGENCY_NAME_LABEL.toLowerCase()} (min 2 letters)`;
    }
    if (!form.email.trim()) return "Email is required";
    if (!form.phone.trim()) return "First confirmation number is required";
    if (form.phone.replace(/\D/g, "").length < 10) {
      return "First confirmation number must be at least 10 digits";
    }
    if (!form.secondConfirmationNumber.trim()) return "Second confirmation number is required";
    if (form.secondConfirmationNumber.replace(/\D/g, "").length < 10) {
      return "Second confirmation number must be at least 10 digits";
    }
    if (form.status !== "ACTIVE") {
      return "Set status to Active to create this firm / agency.";
    }
    if (!resolveAdminName()) {
      return `Enter ${AGENCY_NAME_LABEL.toLowerCase()} or proprietor / director name`;
    }
    if (!form.adminPassword.trim()) return "Password is required";
    if (form.adminPassword.trim().length < 8) {
      return "Enter a secure password (minimum 8 characters)";
    }
    const dobError = validateDobParts(dobParts);
    if (dobError) return dobError;
    return "";
  };

  const resetForm = () => {
    setForm(initialForm);
    setSelectedPlanKey("");
    setDirectors([""]);
    setCompanyPhotoFile(null);
    setCompanyPhotoPreview("");
    setAdminPhotoFile(null);
    setAdminPhotoPreview("");
  };

  const handleImagePick = (kind, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (JPEG, PNG, or WebP).");
      return;
    }
    const preview = URL.createObjectURL(file);
    if (kind === "company") {
      setCompanyPhotoFile(file);
      setCompanyPhotoPreview(preview);
    } else {
      setAdminPhotoFile(file);
      setAdminPhotoPreview(preview);
    }
    setError("");
  };

  const isCreateEnabled = form.status === "ACTIVE";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setCreatedCreds(null);

    if (!isCreateEnabled) {
      setError("Set status to Active to create this firm / agency.");
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      let companyCode = form.companyCode.trim();
      try {
        const codeRes = await companyService.getNextCompanyCode(
          form.companyName.trim(),
          auth.token
        );
        companyCode =
          codeRes?.data?.companyCode ||
          codeRes?.data?.data?.companyCode ||
          codeRes?.companyCode ||
          companyCode;
      } catch {
        /* use last previewed code */
      }

      const payload = {
        ...form,
        companyCode,
        companyName: form.companyName.trim(),
        contactPersonName: formatDirectorsForSave(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        panNumber: form.panNumber.trim().toUpperCase(),
        address: form.address.trim(),
        gstNumber: form.gstNumber.trim(),
        aadhaarNumber: form.aadhaarNumber.trim(),
        status: "ACTIVE",
        adminName: resolveAdminName(),
        adminEmail: form.email.trim(),
        adminPhone: form.secondConfirmationNumber.trim(),
        adminPassword: form.adminPassword,
        adminDistrict: form.adminDistrict.trim(),
        adminState: form.adminState.trim(),
        adminPincode: form.adminPincode.trim(),
        adminDateOfBirth: partsToDobIso(dobParts) || form.adminDateOfBirth.trim(),
        adminPost: form.adminPost.trim(),
      };

      const res = await companyService.createCompany(payload, auth.token);

      const companyId =
        res?.data?.company?._id ||
        res?.data?.company?.id ||
        res?.company?._id;

      if (companyId) {
        if (companyPhotoFile) {
          await companyService.uploadCompanyPhoto(companyId, companyPhotoFile, auth.token);
        }
        if (adminPhotoFile) {
          await companyService.uploadRepoAdminPhoto(companyId, adminPhotoFile, auth.token);
        }
      }

      const repoAdmin =
        res?.data?.repoAdmin ||
        res?.repoAdmin ||
        {
          email: form.email.trim(),
          phone: payload.adminPhone,
          password: payload.adminPassword,
        };

      setCreatedCreds({
        email: repoAdmin.email || form.email.trim(),
        phone: repoAdmin.phone || payload.adminPhone,
        password: repoAdmin.password || payload.adminPassword,
      });
      resetForm();
      alert("Repossession firm / agency created successfully");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create repossession firm / agency");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page create-company-page repo-form-page">
      <div className="create-company-header">
        <div>
          <h2>{CREATE_REPOSSESSION_FIRM_AGENCY}</h2>
        </div>

        <button
          type="button"
          className="secondary-page-btn"
          onClick={() => navigate("/ssdi/companies")}
        >
          Back to Companies
        </button>
      </div>

      <form
        className={`create-company-form${!isCreateEnabled ? " create-company-form--locked" : ""}`}
        onSubmit={handleSubmit}
      >
        <div className="create-company-card">
          <section
            className="create-company-section create-company-section--ssdi-photos"
            aria-label="Photos and status"
          >
            <div className="ssdi-create-status-corner">
              <div className="create-company-status-bar create-company-status-bar--corner">
                <div className="create-company-status-bar__controls">
                  <label htmlFor="companyStatus" className="create-company-status-bar__label">
                    Status
                  </label>
                  <select
                    id="companyStatus"
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className={`create-company-status-select ${
                      form.status === "INACTIVE"
                        ? "create-company-status-select--inactive"
                        : "create-company-status-select--active"
                    }`}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Deactivate</option>
                  </select>
                </div>
                {!isCreateEnabled && (
                  <p className="create-company-status-hint" role="status">
                    Switch to Active to enable create.
                  </p>
                )}
              </div>
            </div>

            <div className="create-company-uploads-row">
              <div className="create-company-upload-slot">
                <span className="create-company-upload-slot__label">Company logo</span>
                <button
                  type="button"
                  className="create-company-upload-slot__picker"
                  onClick={() => companyLogoInputRef.current?.click()}
                >
                  <span className="create-company-upload-preview" aria-hidden>
                    {companyPhotoPreview ? (
                      <img src={companyPhotoPreview} alt="" />
                    ) : (
                      <span className="create-company-upload-preview__placeholder">
                        {(form.companyName || "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="create-company-upload-slot__action">
                    <FiUpload aria-hidden />
                    {companyPhotoPreview ? "Change logo" : "Upload logo"}
                  </span>
                </button>
                <input
                  ref={companyLogoInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => handleImagePick("company", e)}
                />
              </div>

              <div className="create-company-upload-slot">
                <span className="create-company-upload-slot__label">Admin photo</span>
                <button
                  type="button"
                  className="create-company-upload-slot__picker"
                  onClick={() => adminPhotoInputRef.current?.click()}
                >
                  <span className="create-company-upload-preview" aria-hidden>
                    {adminPhotoPreview ? (
                      <img src={adminPhotoPreview} alt="" />
                    ) : (
                      <span className="create-company-upload-preview__placeholder">
                        {(resolveAdminName() || "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="create-company-upload-slot__action">
                    <FiUpload aria-hidden />
                    {adminPhotoPreview ? "Change photo" : "Upload photo"}
                  </span>
                </button>
                <input
                  ref={adminPhotoInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => handleImagePick("admin", e)}
                />
              </div>
            </div>
          </section>

          <section className="create-company-section" aria-labelledby="create-section-firm">
            <header className="create-company-section__head" id="create-section-firm">
              <h3>Firm/agency details</h3>
            </header>
            <div className="form-grid two-column">
            <div className="form-group">
              <label>{AGENCY_NAME_LABEL} *</label>
              <input
                name="companyName"
                placeholder={`Enter ${AGENCY_NAME_LABEL.toLowerCase()}`}
                value={form.companyName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Firm / Agency Code *</label>
              <input
                name="companyCode"
                placeholder={
                  codeLoading ? "Generating code..." : `Enter ${AGENCY_NAME_LABEL.toLowerCase()} first`
                }
                value={form.companyCode}
                readOnly
                className="input-readonly"
              />
              {codeLoading && (
                <p className="field-hint muted">Generating firm / agency code…</p>
              )}
              {!codeLoading && codeHint && (
                <p className="field-hint muted">{codeHint}</p>
              )}
            </div>

            <div className="form-group full-width">
              <label htmlFor="ssdiCreateAdminPost">Post</label>
              <select
                id="ssdiCreateAdminPost"
                name="adminPost"
                value={form.adminPost}
                onChange={handleChange}
              >
                <option value="">Select post</option>
                {REPO_ADMIN_POST_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group full-width directors-field">
              <label>Proprietor / Partners / Directors name</label>
              {directors.map((name, index) => (
                <div key={`director-${index}`} className="director-row">
                  <input
                    type="text"
                    value={name}
                    placeholder={
                      directors.length > 1
                        ? `Director ${index + 1} name`
                        : "Enter proprietor / partners / directors name"
                    }
                    onChange={(e) => updateDirector(index, e.target.value)}
                  />
                  {directors.length > 1 && (
                    <button
                      type="button"
                      className="secondary-page-btn director-row__remove"
                      onClick={() => removeDirector(index)}
                      aria-label={`Remove director ${index + 1}`}
                    >
                      <FiTrash2 aria-hidden />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="primary-page-btn director-row__add"
                onClick={addDirector}
              >
                <FiPlus aria-hidden />
                Add another director/partner
              </button>
            </div>
            </div>
          </section>

          <section className="create-company-section" aria-labelledby="create-section-contact">
            <header className="create-company-section__head" id="create-section-contact">
              <h3>Contact</h3>
            </header>
            <div className="form-grid two-column profile-contact-grid">
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  name="email"
                  placeholder="Enter email"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group form-group--dob">
                <label htmlFor="ssdi-create-admin-dob-day">Date of birth</label>
                <ManualDobFields
                  value={form.adminDateOfBirth}
                  onChange={handleAdminDobChange}
                  idPrefix="ssdi-create-admin-dob"
                />
                <p className="field-hint muted">DD / MM / YYYY</p>
              </div>

              <div className="form-group">
                <label>First Confirmation Number *</label>
              <input
                type="tel"
                name="phone"
                placeholder="Enter first confirmation number"
                value={form.phone}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Second Confirmation Number *</label>
              <input
                type="tel"
                name="secondConfirmationNumber"
                placeholder="Enter second confirmation number"
                value={form.secondConfirmationNumber}
                onChange={handleChange}
              />
            </div>
            </div>
          </section>

          <section className="create-company-section" aria-labelledby="create-section-tax">
            <header className="create-company-section__head" id="create-section-tax">
              <h3>Tax &amp; registration</h3>
            </header>
            <div className="form-grid create-company-tax-grid">
            <div className="form-group">
              <label>PAN Number</label>
              <input
                name="panNumber"
                placeholder="Enter PAN number"
                value={form.panNumber}
                onChange={handleChange}
                maxLength={10}
                style={{ textTransform: "uppercase" }}
              />
            </div>

            <div className="form-group">
              <label>Aadhaar Number</label>
              <input
                name="aadhaarNumber"
                placeholder="Enter Aadhaar number"
                value={form.aadhaarNumber}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>GST Number</label>
              <input
                name="gstNumber"
                placeholder="Enter GST number"
                value={form.gstNumber}
                onChange={handleChange}
              />
            </div>
            </div>
          </section>

          <section className="create-company-section" aria-labelledby="create-section-location">
            <header className="create-company-section__head" id="create-section-location">
              <h3>Address</h3>
            </header>
            <div className="form-grid two-column">
            <div className="form-group full-width">
              <label>Address</label>
              <input
                name="address"
                placeholder="Enter firm / agency address"
                value={form.address}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>District</label>
              <input
                name="adminDistrict"
                placeholder="Enter district"
                value={form.adminDistrict}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>State</label>
              <StateCombobox
                id="adminState"
                value={form.adminState}
                onChange={(state) =>
                  setForm((prev) => ({ ...prev, adminState: state }))
                }
              />
            </div>

            <div className="form-group">
              <label>Pincode</label>
              <input
                name="adminPincode"
                placeholder="6-digit pincode"
                value={form.adminPincode}
                onChange={handleChange}
                inputMode="numeric"
                maxLength={6}
              />
            </div>

            <div className="form-group full-width">
              <label>Password *</label>
              <input
                type="password"
                name="adminPassword"
                placeholder="Enter secure password (min. 8 characters)"
                value={form.adminPassword}
                onChange={handleChange}
                minLength={8}
                autoComplete="new-password"
                aria-describedby="admin-password-hint"
              />
              <p id="admin-password-hint" className="field-hint muted">
                Enter a secure password with at least 8 characters.
              </p>
            </div>
            </div>
          </section>

          <section className="create-company-section create-company-section--last" aria-labelledby="create-section-plan">
            <header className="create-company-section__head" id="create-section-plan">
              <h3>Subscription</h3>
            </header>
            <div className="form-grid two-column">
            <div className="form-group full-width">
              <label>Subscription Plan</label>
              {plansLoading ? (
                <input value="Loading plans..." readOnly />
              ) : (
                <div className="subscription-plan-field">
                  <select
                    id="subscriptionPlan"
                    name="subscriptionPlan"
                    value={selectedPlanKey}
                    onChange={handlePlanDropdownChange}
                  >
                    <option value="">Select subscription plan</option>
                    {SSDI_PLANS.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} — {plan.priceLabel} / {plan.priceUnit} ({plan.userLimitLabel})
                      </option>
                    ))}
                  </select>
                  <Link
                    to={buildPlansUrl("/ssdi/plans", {
                      planId: selectedPlanKey || undefined,
                      returnTo: CREATE_RETURN_PATH,
                    })}
                    className="subscription-plan-view-link"
                  >
                    {selectedPlanKey
                      ? `View ${SSDI_PLANS.find((p) => p.id === selectedPlanKey)?.name} plan details →`
                      : "Browse & compare all plans →"}
                  </Link>
                </div>
              )}
            </div>
            </div>
          </section>
        </div>

        {error && <p className="error-text create-company-error">{error}</p>}

        <div className="create-company-actions create-company-actions--sticky">
          <button
            type="button"
            className="secondary-page-btn"
            onClick={() => resetForm()}
            disabled={loading}
          >
            Reset
          </button>

          <button
            type="submit"
            className="primary-page-btn"
            disabled={
              loading || codeLoading || !form.companyCode.trim() || !isCreateEnabled
            }
            title={
              !isCreateEnabled
                ? "Set status to Active to create this firm / agency"
                : undefined
            }
          >
            {loading ? "Creating..." : CREATE_REPOSSESSION_FIRM_AGENCY}
          </button>
        </div>
      </form>
      {createdCreds && (
        <div className="created-credentials-card">
          <h3>Login credentials</h3>
          <p>
            <strong>Email:</strong> {createdCreds.email || "—"}
          </p>
          <p>
            <strong>Second Confirmation Number:</strong> {createdCreds.phone || "—"}
          </p>
          <p>
            <strong>Password:</strong> {createdCreds.password || "—"}
          </p>
        </div>
      )}
    </div>
  );
}
