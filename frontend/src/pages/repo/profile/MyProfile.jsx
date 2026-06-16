import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FiCreditCard, FiPlus, FiSave, FiTrash2, FiUpload } from "react-icons/fi";
import useAuth from "../../../hooks/useAuth";
import { authService } from "../../../services/auth.service";
import repoAdminService from "../../../services/repoAdmin.service";
import { formatRepoRole } from "../../../constants/repoRoles";
import {
  AGENCY_NAME_LABEL,
  AGENCY_PROFILE_TITLE,
  STAFF_PROFILE_TITLE,
} from "../../../constants/companyLabels";
import { REPO_ADMIN_POST_OPTIONS } from "../../../constants/repoAdminPost";
import { fileAssetUrl } from "../../../utils/fileAssetUrl";
import StateCombobox from "../../../components/userProfile/StateCombobox";
import ManualDobFields from "../../../components/common/ManualDobFields";
import {
  parseDobToParts,
  partsToDobIso,
  validateDobParts,
} from "../../../utils/dateOfBirthUtils";
import "../../../styles/users.css";
import "../../../styles/profile.css";

const emptyUserForm = {
  name: "",
  fatherName: "",
  dateOfBirth: "",
  post: "",
  district: "",
  state: "",
  pincode: "",
  address: "",
  city: "",
  agencyName: "",
  bloodGroup: "",
};

const emptyPasswordForm = {
  newPassword: "",
  confirmPassword: "",
};

const emptyCompanyForm = {
  companyName: "",
  companyCode: "",
  email: "",
  phone: "",
  secondConfirmationNumber: "",
  address: "",
  panNumber: "",
  gstNumber: "",
  aadhaarNumber: "",
  status: "ACTIVE",
  registrationSource: "ADMIN",
};

function directorsFromContact(contactPersonName) {
  const parts = (contactPersonName || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : [""];
}

export default function MyProfile() {
  const { auth, patchUser } = useAuth();
  const isRepoAdmin = auth?.user?.role === "REPO_ADMIN";

  const [userForm, setUserForm] = useState(emptyUserForm);
  const [companyForm, setCompanyForm] = useState(emptyCompanyForm);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [directors, setDirectors] = useState([""]);
  const [companyPhotoPreview, setCompanyPhotoPreview] = useState("");
  const [adminPhotoPreview, setAdminPhotoPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingCompanyLogo, setUploadingCompanyLogo] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dobParts, setDobParts] = useState({ day: "", month: "", year: "" });

  const companyLogoInputRef = useRef(null);
  const adminPhotoInputRef = useRef(null);

  const isSsdiProvisioned = companyForm.registrationSource === "ADMIN";
  const isSelfRegistered = companyForm.registrationSource === "SELF";
  const canEditLockedFields = isRepoAdmin && !isSsdiProvisioned;

  const applyCompany = useCallback((company) => {
    if (!company) return;
    setCompanyForm({
      companyName: company.companyName || "",
      companyCode: company.companyCode || "",
      email: company.email || company.adminEmail || "",
      phone: company.phone || "",
      secondConfirmationNumber: company.adminPhone || company.phone || "",
      address: company.address || "",
      panNumber: company.panNumber || "",
      gstNumber: company.gstNumber || "",
      aadhaarNumber: company.aadhaarNumber || "",
      status: company.status || "ACTIVE",
      registrationSource: company.registrationSource || "ADMIN",
    });
    setDirectors(directorsFromContact(company.contactPersonName));
    setCompanyPhotoPreview(fileAssetUrl(company.photoUrl));
  }, []);

  const applyUser = useCallback((user) => {
    if (!user) return;
    setUserForm({
      name: user.name || "",
      fatherName: user.fatherName || "",
      dateOfBirth: user.dateOfBirth || "",
      post: user.post || "",
      district: user.district || "",
      state: user.state || "",
      pincode: user.pincode || "",
      address: user.address || "",
      city: user.city || "",
      agencyName: user.agencyName || "",
      bloodGroup: user.bloodGroup || "",
    });
    setDobParts(parseDobToParts(user.dateOfBirth || ""));
    setAdminPhotoPreview(fileAssetUrl(user.photoUrl));
    if (user.company) {
      applyCompany({
        ...user.company,
        email: user.company.email || user.email || "",
      });
    }
  }, [applyCompany]);

  const loadProfile = useCallback(async () => {
    if (!auth?.token) return;
    try {
      setLoading(true);
      setError("");

      const res = await authService.getProfile(auth.token);
      const user = res?.data?.user || res?.user;
      applyUser(user);

      if (isRepoAdmin) {
        const companyRes = await repoAdminService.getMyCompany(auth.token);
        const company = companyRes?.data || companyRes?.company;
        if (company) {
          applyCompany(company);
        }
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [auth?.token, isRepoAdmin, applyUser, applyCompany]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleUserChange = (e) => {
    const { name, value } = e.target;
    setUserForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCompanyChange = (e) => {
    const { name, value } = e.target;
    setCompanyForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const updateDirector = (index, value) => {
    setDirectors((prev) => prev.map((name, i) => (i === index ? value : name)));
  };

  const addDirector = () => setDirectors((prev) => [...prev, ""]);

  const removeDirector = (index) => {
    setDirectors((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const formatDirectorsForSave = () =>
    directors.map((name) => name.trim()).filter(Boolean).join(", ");

  const resolveAdminName = () => {
    const firstDirector = directors.map((n) => n.trim()).find(Boolean);
    return firstDirector || userForm.name.trim() || companyForm.companyName.trim();
  };

  const uploadAdminPhoto = async (file) => {
    setUploadingPhoto(true);
    setError("");
    setSuccess("");
    try {
      const res = await authService.uploadProfilePhoto(file, auth.token);
      const user = res?.data?.user || res?.user;
      if (user) {
        applyUser(user);
        patchUser({ ...user, id: user.id || user._id });
      }
      setSuccess("Admin photo updated.");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
      if (adminPhotoInputRef.current) adminPhotoInputRef.current.value = "";
    }
  };

  const uploadCompanyLogo = async (file) => {
    setUploadingCompanyLogo(true);
    setError("");
    setSuccess("");
    try {
      const res = await repoAdminService.uploadMyCompanyPhoto(file, auth.token);
      const company = res?.data?.company || res?.company;
      if (company) {
        applyCompany(company);
        patchUser({
          ...auth.user,
          company: {
            ...auth.user?.company,
            companyName: company.companyName,
            companyCode: company.companyCode,
            photoUrl: company.photoUrl,
          },
        });
      }
      setSuccess("Company logo updated.");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to upload logo");
    } finally {
      setUploadingCompanyLogo(false);
      if (companyLogoInputRef.current) companyLogoInputRef.current.value = "";
    }
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
      setCompanyPhotoPreview(preview);
      uploadCompanyLogo(file);
    } else {
      setAdminPhotoPreview(preview);
      uploadAdminPhoto(file);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const name = isRepoAdmin ? resolveAdminName() : userForm.name.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }

    const dobError = validateDobParts(dobParts);
    if (dobError) {
      setError(dobError);
      return;
    }

    if (isRepoAdmin && canEditLockedFields && !companyForm.companyName.trim()) {
      setError(`${AGENCY_NAME_LABEL} is required.`);
      return;
    }

    if (isRepoAdmin && !companyForm.email.trim()) {
      setError("Email is required.");
      return;
    }

    const changingPassword =
      passwordForm.newPassword.trim() || passwordForm.confirmPassword.trim();

    if (isRepoAdmin && changingPassword) {
      if (!passwordForm.newPassword.trim()) {
        setError("Enter a new password.");
        return;
      }
      if (passwordForm.newPassword.trim().length < 8) {
        setError("New password must be at least 8 characters.");
        return;
      }
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        setError("New password and confirmation do not match.");
        return;
      }
    }

    const dateOfBirth = partsToDobIso(dobParts);
    setSaving(true);

    try {
      let updatedCompany = null;

      if (isRepoAdmin) {
        const companyPayload = {
          contactPersonName: formatDirectorsForSave(),
          email: companyForm.email.trim(),
          phone: companyForm.phone.trim(),
          address: companyForm.address.trim(),
        };

        if (canEditLockedFields) {
          companyPayload.companyName = companyForm.companyName.trim();
          companyPayload.panNumber = companyForm.panNumber.trim().toUpperCase();
          companyPayload.gstNumber = companyForm.gstNumber.trim();
          companyPayload.aadhaarNumber = companyForm.aadhaarNumber.trim();
        }

        const companyRes = await repoAdminService.updateMyCompany(
          companyPayload,
          auth.token
        );
        updatedCompany = companyRes?.data?.company || companyRes?.company;
        if (updatedCompany) applyCompany(updatedCompany);
      }

      const profilePayload = {
        name,
        dateOfBirth,
        post: userForm.post.trim(),
        district: userForm.district.trim(),
        state: userForm.state.trim(),
        pincode: userForm.pincode.trim(),
        address: userForm.address.trim(),
        agencyName: userForm.agencyName.trim(),
      };

      if (isRepoAdmin) {
        profilePayload.phone = companyForm.secondConfirmationNumber.trim();
      }

      if (isRepoAdmin && passwordForm.newPassword.trim()) {
        profilePayload.newPassword = passwordForm.newPassword.trim();
      }

      const res = await authService.updateProfile(profilePayload, auth.token);
      const user = res?.data?.user || res?.user;
      if (user) {
        applyUser(user);
        patchUser({
          ...user,
          id: user.id || user._id,
          email: user.email,
          company: updatedCompany
            ? {
                companyName: updatedCompany.companyName,
                companyCode: updatedCompany.companyCode,
                photoUrl: updatedCompany.photoUrl,
              }
            : user.company,
        });
      }

      if (changingPassword) {
        setPasswordForm(emptyPasswordForm);
      }

      setSuccess(
        isSelfRegistered
          ? "Profile saved. SSDI has been notified to review your agency information."
          : changingPassword
            ? "Profile and password saved."
            : "Profile saved."
      );
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const lockedProps = (locked) =>
    locked
      ? { readOnly: true, className: "input-readonly", disabled: true }
      : { disabled: loading || saving };

  if (!isRepoAdmin) {
    const company = auth?.user?.company;

    return (
      <div className="page create-company-page repo-form-page profile-page">
        <header className="create-company-header profile-page__header">
          <h2>{STAFF_PROFILE_TITLE}</h2>
          <Link to="/id-card" className="secondary-page-btn profile-page__id-card-link">
            <FiCreditCard aria-hidden />
            ID Card
          </Link>
        </header>

        <form
          className="create-company-form create-company-card profile-page__form"
          onSubmit={handleSave}
        >
          <section className="create-company-section" aria-label="Photo">
            <div className="create-company-upload-slot profile-page__photo-slot">
                  <span className="create-company-upload-slot__label">Your photo</span>
                  <button
                    type="button"
                    className="create-company-upload-slot__picker"
                    onClick={() => adminPhotoInputRef.current?.click()}
                    disabled={uploadingPhoto || loading}
                  >
                    <span
                      className="create-company-upload-preview profile-photo-preview--user"
                      aria-hidden
                    >
                      {adminPhotoPreview ? (
                        <img src={adminPhotoPreview} alt="" />
                      ) : (
                        <span className="create-company-upload-preview__placeholder">
                          {(userForm.name || "?").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="create-company-upload-slot__action">
                      <FiUpload aria-hidden />
                      {uploadingPhoto
                        ? "Uploading…"
                        : adminPhotoPreview
                          ? "Change photo"
                          : "Upload photo"}
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
          </section>

          <section className="create-company-section" aria-labelledby="staff-profile-personal">
              <header className="create-company-section__head" id="staff-profile-personal">
                <h3>Personal details</h3>
              </header>
              <div className="form-grid two-column">
                <div className="form-group">
                  <label htmlFor="staffProfileName">Full name *</label>
                  <input
                    id="staffProfileName"
                    name="name"
                    value={userForm.name}
                    onChange={handleUserChange}
                    placeholder="Enter full name"
                    disabled={loading || saving}
                  />
                </div>
                <div className="form-group">
                  <label>Father&apos;s name</label>
                  <input
                    value={userForm.fatherName || "—"}
                    readOnly
                    className="input-readonly"
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    value={auth?.user?.email || "—"}
                    readOnly
                    className="input-readonly"
                  />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <input
                    value={formatRepoRole(auth?.user?.role)}
                    readOnly
                    className="input-readonly"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="staffProfilePost">Post</label>
                  <input
                    id="staffProfilePost"
                    name="post"
                    value={userForm.post}
                    onChange={handleUserChange}
                    placeholder="Your post / designation"
                    disabled={loading || saving}
                  />
                </div>
                <div className="form-group">
                  <label>Blood group</label>
                  <input
                    value={userForm.bloodGroup || "—"}
                    readOnly
                    className="input-readonly"
                  />
                </div>
                <div className="form-group form-group--dob full-width">
                  <label htmlFor="profile-dob-day">Date of birth</label>
                  <ManualDobFields
                    value={userForm.dateOfBirth}
                    onChange={setDobParts}
                    disabled={loading || saving}
                    idPrefix="profile-dob"
                  />
                  <p className="field-hint muted">Format: DD / MM / YYYY</p>
                </div>
              </div>
            </section>

            <section className="create-company-section" aria-labelledby="staff-profile-contact">
              <header className="create-company-section__head" id="staff-profile-contact">
                <h3>Contact</h3>
              </header>
              <div className="form-grid two-column profile-contact-grid">
                <div className="form-group">
                  <label>Mobile number</label>
                  <input
                    value={auth?.user?.phone || "—"}
                    readOnly
                    className="input-readonly"
                  />
                  <p className="field-hint muted">
                    Contact your repo admin to change your registered mobile number.
                  </p>
                </div>
              </div>
            </section>

            <section className="create-company-section" aria-labelledby="staff-profile-address">
              <header className="create-company-section__head" id="staff-profile-address">
                <h3>Address</h3>
              </header>
              <div className="form-grid two-column profile-address-grid">
                <div className="form-group full-width">
                  <label htmlFor="staffProfileAddress">Address</label>
                  <input
                    id="staffProfileAddress"
                    name="address"
                    value={userForm.address}
                    onChange={handleUserChange}
                    placeholder="House no., street, area"
                    disabled={loading || saving}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="staffProfilePincode">Pincode</label>
                  <input
                    id="staffProfilePincode"
                    name="pincode"
                    value={userForm.pincode}
                    onChange={handleUserChange}
                    placeholder="6-digit pincode"
                    inputMode="numeric"
                    maxLength={6}
                    disabled={loading || saving}
                  />
                </div>
                <div className="form-group">
                  <label>City</label>
                  <input value={userForm.city || "—"} readOnly className="input-readonly" />
                </div>
                <div className="form-group">
                  <label>District</label>
                  <input
                    name="district"
                    value={userForm.district}
                    onChange={handleUserChange}
                    placeholder="Enter district"
                    disabled={loading || saving}
                  />
                </div>
                <div className="form-group">
                  <label>State</label>
                  <StateCombobox
                    id="staffProfileState"
                    value={userForm.state}
                    onChange={(state) => setUserForm((prev) => ({ ...prev, state }))}
                  />
                </div>
              </div>
            </section>

          {(company?.companyName || userForm.agencyName) && (
            <section
              className="create-company-section create-company-section--last"
              aria-labelledby="staff-profile-agency"
            >
              <header className="create-company-section__head" id="staff-profile-agency">
                <h3>Agency</h3>
              </header>
              <div className="form-grid two-column">
                <div className="form-group">
                  <label>{AGENCY_NAME_LABEL}</label>
                  <input
                    value={company?.companyName || userForm.agencyName || "—"}
                    readOnly
                    className="input-readonly"
                  />
                </div>
                <div className="form-group">
                  <label>Firm / Agency code</label>
                  <input
                    value={company?.companyCode || "—"}
                    readOnly
                    className="input-readonly"
                  />
                </div>
              </div>
            </section>
          )}

          {error && <p className="error-text create-company-error">{error}</p>}
          {success && <p className="cfm-status">{success}</p>}

          <div className="create-company-actions create-company-actions--sticky">
            <button type="submit" className="primary-page-btn" disabled={saving || loading}>
              <FiSave aria-hidden />
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="page create-company-page repo-form-page profile-page">
      <header className="create-company-header profile-page__header">
        <h2>{AGENCY_PROFILE_TITLE}</h2>
        <Link to="/id-card" className="secondary-page-btn profile-page__id-card-link">
          <FiCreditCard aria-hidden />
          ID Card
        </Link>
      </header>

      {isSelfRegistered && companyForm.status === "PENDING" && (
        <p className="profile-pending-banner">
          Your agency registration is pending SSDI review. You can update your details
          here; SSDI will be notified and can activate your agency from{" "}
          <strong>Registrations</strong>.
        </p>
      )}

      {isSelfRegistered && companyForm.status !== "PENDING" && (
        <p className="profile-info-banner">
          Profile changes are sent to SSDI for awareness.
        </p>
      )}

      <form
        className="create-company-form create-company-card profile-page__form"
        onSubmit={handleSave}
      >
        <section className="create-company-section" aria-label="Photos">
          <div className="create-company-uploads-row profile-admin-uploads-row">
              <div className="create-company-upload-slot">
                <span className="create-company-upload-slot__label">Company logo</span>
                <button
                  type="button"
                  className="create-company-upload-slot__picker"
                  onClick={() => companyLogoInputRef.current?.click()}
                  disabled={uploadingCompanyLogo || loading}
                >
                  <span className="create-company-upload-preview" aria-hidden>
                    {companyPhotoPreview ? (
                      <img src={companyPhotoPreview} alt="" />
                    ) : (
                      <span className="create-company-upload-preview__placeholder">
                        {(companyForm.companyName || "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="create-company-upload-slot__action">
                    <FiUpload aria-hidden />
                    {uploadingCompanyLogo ? "Uploading…" : companyPhotoPreview ? "Change logo" : "Upload logo"}
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
                  disabled={uploadingPhoto || loading}
                >
                  <span className="create-company-upload-preview profile-photo-preview--user" aria-hidden>
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
                    {uploadingPhoto ? "Uploading…" : adminPhotoPreview ? "Change photo" : "Upload photo"}
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

        <section className="create-company-section" aria-labelledby="profile-firm">
            <header className="create-company-section__head" id="profile-firm">
              <h3>Firm/agency details</h3>
            </header>
            <div className="form-grid two-column">
              <div className="form-group">
                <label>{AGENCY_NAME_LABEL} *</label>
                <input
                  name="companyName"
                  value={companyForm.companyName}
                  onChange={handleCompanyChange}
                  placeholder={`Enter ${AGENCY_NAME_LABEL.toLowerCase()}`}
                  {...lockedProps(isSsdiProvisioned)}
                />
              </div>

              <div className="form-group">
                <label>Firm / Agency Code</label>
                <input
                  value={companyForm.companyCode || "—"}
                  readOnly
                  className="input-readonly"
                />
              </div>

              <div className="form-group full-width">
                <label htmlFor="profilePost">Post</label>
                <select
                  id="profilePost"
                  name="post"
                  value={userForm.post}
                  onChange={handleUserChange}
                  disabled={loading || saving}
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
                      disabled={loading || saving}
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
                  disabled={loading || saving}
                >
                  <FiPlus aria-hidden />
                  Add another director/partner
                </button>
              </div>
            </div>
          </section>

          <section className="create-company-section" aria-labelledby="profile-contact">
            <header className="create-company-section__head" id="profile-contact">
              <h3>Contact</h3>
            </header>
            <div className="form-grid two-column profile-contact-grid">
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  name="email"
                  value={companyForm.email}
                  onChange={handleCompanyChange}
                  placeholder="Enter email"
                  disabled={loading || saving}
                  required
                />
              </div>
              <div className="form-group form-group--dob">
                <label htmlFor="repo-admin-profile-dob-day">Date of birth</label>
                <ManualDobFields
                  value={userForm.dateOfBirth}
                  onChange={setDobParts}
                  disabled={loading || saving}
                  idPrefix="repo-admin-profile-dob"
                />
                <p className="field-hint muted">DD / MM / YYYY</p>
              </div>
              <div className="form-group">
                <label>First confirmation number</label>
                <input
                  type="tel"
                  name="phone"
                  value={companyForm.phone}
                  onChange={handleCompanyChange}
                  placeholder="Enter first confirmation number"
                  disabled={loading || saving}
                />
              </div>
              <div className="form-group">
                <label>Second confirmation number</label>
                <input
                  type="tel"
                  name="secondConfirmationNumber"
                  value={companyForm.secondConfirmationNumber}
                  onChange={handleCompanyChange}
                  placeholder="Enter second confirmation number"
                  disabled={loading || saving}
                />
              </div>
            </div>
          </section>

          <section className="create-company-section" aria-labelledby="profile-tax">
            <header className="create-company-section__head" id="profile-tax">
              <h3>Tax &amp; registration</h3>
            </header>
            <div className="form-grid create-company-tax-grid">
              <div className="form-group">
                <label>PAN Number</label>
                <input
                  name="panNumber"
                  value={companyForm.panNumber}
                  onChange={handleCompanyChange}
                  placeholder="Enter PAN number"
                  maxLength={10}
                  style={{ textTransform: "uppercase" }}
                  {...lockedProps(isSsdiProvisioned)}
                />
              </div>
              <div className="form-group">
                <label>Aadhaar Number</label>
                <input
                  name="aadhaarNumber"
                  value={companyForm.aadhaarNumber}
                  onChange={handleCompanyChange}
                  placeholder="Enter Aadhaar number"
                  {...lockedProps(isSsdiProvisioned)}
                />
              </div>
              <div className="form-group">
                <label>GST Number</label>
                <input
                  name="gstNumber"
                  value={companyForm.gstNumber}
                  onChange={handleCompanyChange}
                  placeholder="Enter GST number"
                  {...lockedProps(isSsdiProvisioned)}
                />
              </div>
            </div>
          </section>

          <section className="create-company-section" aria-labelledby="profile-address">
            <header className="create-company-section__head" id="profile-address">
              <h3>Address</h3>
            </header>
            <div className="form-grid two-column profile-address-grid">
              <div className="form-group full-width">
                <label>Address</label>
                <input
                  name="address"
                  value={companyForm.address}
                  onChange={handleCompanyChange}
                  placeholder="Enter firm / agency address"
                  disabled={loading || saving}
                />
              </div>
              <div className="form-group">
                <label>District</label>
                <input
                  name="district"
                  value={userForm.district}
                  onChange={handleUserChange}
                  placeholder="Enter district"
                  disabled={loading || saving}
                />
              </div>
              <div className="form-group">
                <label>State</label>
                <StateCombobox
                  id="profileState"
                  value={userForm.state}
                  onChange={(state) => setUserForm((prev) => ({ ...prev, state }))}
                />
              </div>
              <div className="form-group">
                <label>Pincode</label>
                <input
                  name="pincode"
                  value={userForm.pincode}
                  onChange={handleUserChange}
                  placeholder="6-digit pincode"
                  inputMode="numeric"
                  maxLength={6}
                  disabled={loading || saving}
                />
              </div>
            </div>
          </section>

          <section
            className="create-company-section create-company-section--last profile-password-section"
            aria-labelledby="profile-password"
          >
            <header className="create-company-section__head" id="profile-password">
              <h3>Password</h3>
              <p className="muted profile-section-desc">
                Optional — leave blank to keep your current password.
              </p>
            </header>
            <div className="form-grid two-column profile-password-grid">
              <div className="form-group">
                <label htmlFor="profile-new-password">New password</label>
                <input
                  id="profile-new-password"
                  type="password"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  placeholder="Min. 8 characters"
                  minLength={8}
                  autoComplete="new-password"
                  disabled={loading || saving}
                  aria-describedby="profile-new-password-hint"
                />
              </div>
              <div className="form-group">
                <label htmlFor="profile-confirm-password">Confirm new password</label>
                <input
                  id="profile-confirm-password"
                  type="password"
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  placeholder="Re-enter new password"
                  minLength={8}
                  autoComplete="new-password"
                  disabled={loading || saving}
                />
              </div>
              <p id="profile-new-password-hint" className="field-hint muted form-group full-width">
                Minimum 8 characters when setting a new password.
              </p>
            </div>
        </section>

        {error && <p className="error-text create-company-error">{error}</p>}
        {success && <p className="cfm-status">{success}</p>}

        <div className="create-company-actions create-company-actions--sticky">
          <button type="submit" className="primary-page-btn" disabled={saving || loading}>
            <FiSave aria-hidden />
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
