import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FiDownload, FiEdit2, FiPrinter, FiSmartphone } from "react-icons/fi";
import { HiOutlineOfficeBuilding } from "react-icons/hi";
import useAuth from "../../../hooks/useAuth";
import { authService } from "../../../services/auth.service";
import { fileAssetUrl, downloadNodeAsPng } from "../../../utils/fileAssetUrl";
import "../../../styles/idCard.css";

import { formatDobDisplay } from "../../../utils/dateOfBirthUtils";
import { formatRepoAdminPost } from "../../../constants/repoAdminPost";
import { formatRepoRole } from "../../../constants/repoRoles";

/** Post on card: profile post (admin) or job role (staff). */
function postDisplayForIdCard(user) {
  const post = (user?.post || "").trim();
  if (post) return formatRepoAdminPost(post);
  if (user?.role && user.role !== "REPO_ADMIN") {
    return formatRepoRole(user.role);
  }
  return "";
}

function IdCardFace({ data, side }) {
  const user = data?.user || {};
  const company = user?.company || {};
  const photoSrc = fileAssetUrl(user.photoUrl);
  const companyLogoSrc = fileAssetUrl(company.photoUrl);
  const firstAgencyNumber =
    company.firstAgencyNumber || company.phone || "";
  const secondAgencyNumber =
    user.secondAgencyNumber || user.phone || "";
  const location = [user.district, user.state].filter(Boolean).join(", ");
  const postLabel = postDisplayForIdCard(user);

  if (side === "back") {
    return (
      <div className="id-card id-card--back">
        <div className="id-card__back-inner">
          <div className="id-card__back-logo-wrap">
            {companyLogoSrc ? (
              <img
                src={companyLogoSrc}
                alt=""
                className="id-card__back-logo"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="id-card__back-logo id-card__back-logo--placeholder" aria-hidden>
                {(company.companyName || "A").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="id-card__back-copy">
            <p className="id-card__back-line id-card__back-line--primary">
              Authorised Vehicle Repossession Agency
            </p>
            <p className="id-card__back-line id-card__back-line--secondary">Bank / NBFC</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="id-card id-card--front">
      <div className="id-card__banner">
        <p className="id-card__banner-name">{company.companyName || "—"}</p>
        <p className="id-card__banner-code">{company.companyCode || "—"}</p>
      </div>

      <div className="id-card__main">
        <div className="id-card__photo-wrap">
          {photoSrc ? (
            <img
              src={photoSrc}
              alt=""
              className="id-card__photo"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="id-card__photo id-card__photo--placeholder">
              {(user.name || "?").charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="id-card__info">
          <h3 className="id-card__person-name">{user.name || "—"}</h3>
          <dl className="id-card__facts">
            {postLabel ? (
              <div>
                <dt>Post</dt>
                <dd>{postLabel}</dd>
              </div>
            ) : null}
            <div>
              <dt>Date of birth</dt>
              <dd>{formatDobDisplay(user.dateOfBirth)}</dd>
            </div>
            {location ? (
              <div>
                <dt>District &amp; state</dt>
                <dd>{location}</dd>
              </div>
            ) : null}
            {user.pincode ? (
              <div>
                <dt>Pincode</dt>
                <dd>{user.pincode}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>

      <div className="id-card__contact">
        <span className="id-card__phone">
          <HiOutlineOfficeBuilding aria-hidden />
          <span className="id-card__phone-tag">Office</span>
          <strong>{firstAgencyNumber || "—"}</strong>
        </span>
        <span className="id-card__phone">
          <FiSmartphone aria-hidden />
          <span className="id-card__phone-tag">Mobile</span>
          <strong>{secondAgencyNumber || "—"}</strong>
        </span>
      </div>
    </div>
  );
}

export default function IdCardPage() {
  const { auth } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const frontRef = useRef(null);
  const backRef = useRef(null);

  const load = useCallback(async () => {
    if (!auth?.token) return;
    try {
      setLoading(true);
      setError("");
      const res = await authService.getIdCardData(auth.token);
      setData(res?.data || res);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load ID card data");
    } finally {
      setLoading(false);
    }
  }, [auth?.token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const name = (data?.user?.name || "user").replace(/\s+/g, "-").toLowerCase();
      if (frontRef.current) {
        await downloadNodeAsPng(frontRef.current, `${name}-id-front.png`);
      }
      if (backRef.current) {
        await downloadNodeAsPng(backRef.current, `${name}-id-back.png`);
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="page id-card-page">
      <div className="id-card-page__head">
        <div className="id-card-page__actions">
          <Link to="/profile" className="secondary-page-btn id-card-page__action-btn">
            <FiEdit2 aria-hidden />
            Edit
          </Link>
          <button
            type="button"
            className="secondary-page-btn id-card-page__action-btn"
            onClick={() => window.print()}
            disabled={loading || !data}
          >
            <FiPrinter aria-hidden />
            Print
          </button>
          <button
            type="button"
            className="primary-page-btn id-card-page__action-btn"
            onClick={handleDownload}
            disabled={loading || !data || downloading}
          >
            <FiDownload aria-hidden />
            {downloading ? "Downloading…" : "Download"}
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="muted">Loading ID card…</p>
      ) : data ? (
        <div className="id-card-page__preview">
          <div className="id-card-page__pair">
            <div className="id-card-page__side">
              <div className="id-card-page__card-wrap" ref={frontRef}>
                <IdCardFace data={data} side="front" />
              </div>
            </div>
            <div className="id-card-page__side">
              <div className="id-card-page__card-wrap" ref={backRef}>
                <IdCardFace data={data} side="back" />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
