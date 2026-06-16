import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import useAuth from "../../../hooks/useAuth";
import confirmationService from "../../../services/confirmation.service";
import ConfirmationCaseExcelGrid from "../confirmation/ConfirmationCaseExcelGrid";
import InventoryFilesGallery from "../confirmation/InventoryFilesGallery";
import InventoryUploadFormSection from "./InventoryUploadFormSection";
import { formatVehicleNumberDisplay } from "../../../utils/vehicleNumberUtils";
import "../../../styles/confirmation.css";
import "../../../styles/inventoryUpdate.css";

function hasUploadedInventory(confirmation) {
  if (!confirmation) return false;
  return (
    (confirmation.inventoryImages?.length || 0) > 0 ||
    (confirmation.inventoryVideos?.length || 0) > 0 ||
    (confirmation.inventoryPdfs?.length || 0) > 0
  );
}

export default function InventoryUpdate() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const confirmationId = searchParams.get("confirmationId");

  const [confirmation, setConfirmation] = useState(null);
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [imageFiles, setImageFiles] = useState([]);
  const [videoFiles, setVideoFiles] = useState([]);
  const [pdfFiles, setPdfFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    if (!auth?.token || !confirmationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await confirmationService.getById(confirmationId, auth.token);
      setConfirmation(res?.data?.confirmation || null);
      setCaseData(res?.data?.case || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load confirmation");
      setConfirmation(null);
      setCaseData(null);
    } finally {
      setLoading(false);
    }
  }, [auth?.token, confirmationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!confirmationId || !confirmation) return;

    if (!imageFiles.length && !videoFiles.length && !pdfFiles.length) {
      alert("Please select at least one new image, video, or PDF to upload.");
      return;
    }

    const formData = new FormData();
    imageFiles.forEach((file) => formData.append("images", file));
    videoFiles.forEach((file) => formData.append("videos", file));
    pdfFiles.forEach((file) => formData.append("pdfs", file));

    try {
      setSubmitting(true);
      setSuccess("");
      const res = await confirmationService.submitInventory(confirmationId, formData, auth.token);
      setSuccess(res?.message || "Inventory uploaded successfully.");
      setImageFiles([]);
      setVideoFiles([]);
      setPdfFiles([]);
      await loadData();
      window.dispatchEvent(new CustomEvent("app:notifications-changed"));
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to upload inventory");
    } finally {
      setSubmitting(false);
    }
  };

  if (!confirmationId) {
    return (
      <div className="inv-page">
        <div className="inv-card inv-card--full">
          <h2>Inventory update</h2>
          <p className="muted">Open this page from your notification after admin confirms a trace.</p>
          <Link to="/home">Back to Home</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="inv-page">
        <div className="inv-card inv-card--full">
          <p>Loading confirmed vehicle…</p>
        </div>
      </div>
    );
  }

  if (error || !confirmation) {
    return (
      <div className="inv-page">
        <div className="inv-card inv-card--full">
          <p className="error-text">{error || "Confirmation not found."}</p>
          <button type="button" onClick={() => navigate("/home")}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (confirmation.status !== "CONFIRMED") {
    return (
      <div className="inv-page">
        <div className="inv-card inv-card--full">
          <p>This trace is not confirmed yet. Status: {confirmation.status}</p>
          <button type="button" onClick={() => navigate("/home")}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const companyName = auth?.user?.company?.companyName || "";
  const inventorySubmitted =
    confirmation.inventorySubmitted && hasUploadedInventory(confirmation);
  const inventoryConfirmed = Boolean(confirmation.inventoryConfirmed);
  const revisionRequested = Boolean(confirmation.inventoryRevisionRequested);

  return (
    <div className="inv-page">
      <div className="inv-card inv-card--full">
        <div className="inv-header">
          <div>
            <h2>
              {inventorySubmitted
                ? revisionRequested
                  ? "Update inventory"
                  : inventoryConfirmed
                    ? "Inventory confirmed"
                    : "Inventory submitted"
                : "Confirmed vehicle — inventory pre/post"}
            </h2>
            <p className="inv-subtitle">
              {formatVehicleNumberDisplay(confirmation.vehicleNumber)} ·{" "}
              {confirmation.customerName || "—"}
            </p>
          </div>
          <button
            type="button"
            className="inv-back"
            onClick={() => navigate(inventorySubmitted ? "/confirmation?status=CONFIRMED" : "/home")}
          >
            Back
          </button>
        </div>

        <div
          className={`inv-content${inventorySubmitted ? " inv-content--submitted" : ""}`}
        >
          {revisionRequested && (
            <div className="inv-revision-banner" role="alert">
              <strong>Admin requested an inventory update</strong>
              {confirmation.inventoryRevisionNote ? (
                <p>{confirmation.inventoryRevisionNote}</p>
              ) : (
                <p>Please add more or corrected photos, videos, and PDFs below.</p>
              )}
            </div>
          )}

          {inventorySubmitted ? (
            <>
              {!revisionRequested && inventoryConfirmed && (
                <div className="inv-submitted-banner inv-submitted-banner--done">
                  Inventory confirmed by admin on{" "}
                  {confirmation.inventoryConfirmedAt
                    ? new Date(confirmation.inventoryConfirmedAt).toLocaleString()
                    : "—"}
                  .
                </div>
              )}
              {!revisionRequested && !inventoryConfirmed && (
                <div className="inv-submitted-banner">
                  Submitted on{" "}
                  {confirmation.inventorySubmittedAt
                    ? new Date(confirmation.inventorySubmittedAt).toLocaleString()
                    : "—"}
                  . Waiting for repo admin to confirm your inventory.
                </div>
              )}

              <section className="inv-existing inv-existing--primary">
                <h3 className="inv-section-title">Uploaded files</h3>
                <InventoryFilesGallery confirmation={confirmation} />
              </section>

              <InventoryUploadFormSection
                confirmation={confirmation}
                imageFiles={imageFiles}
                videoFiles={videoFiles}
                pdfFiles={pdfFiles}
                setImageFiles={setImageFiles}
                setVideoFiles={setVideoFiles}
                setPdfFiles={setPdfFiles}
                submitting={submitting}
                success={success}
                onSubmit={handleSubmit}
                title="Add more files"
                intro="New files are added to your existing upload. Select images, videos, or PDFs, then submit."
                submitLabel="Upload additional files"
              />
            </>
          ) : (
            <>
              <h3 className="inv-section-title">Vehicle &amp; trace details</h3>
              <div className="inv-details-grid">
                <ConfirmationCaseExcelGrid
                  caseData={caseData}
                  confirmation={confirmation}
                  companyName={companyName}
                />
              </div>

              <InventoryUploadFormSection
                confirmation={confirmation}
                imageFiles={imageFiles}
                videoFiles={videoFiles}
                pdfFiles={pdfFiles}
                setImageFiles={setImageFiles}
                setVideoFiles={setVideoFiles}
                setPdfFiles={setPdfFiles}
                submitting={submitting}
                success={success}
                onSubmit={handleSubmit}
                intro="Select many files at once, or use Choose files multiple times before you submit."
                submitLabel="Submit inventory"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
