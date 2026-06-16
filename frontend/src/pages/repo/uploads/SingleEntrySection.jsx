import { useMemo, useState, useEffect, useRef } from "react";
import { repoCaseService } from "../../../services/repoCase.service";

const initialForm = {
  customerName: "",
  mobileNumber: "",
  alternateMobileNumber: "",
  loanAccountNumber: "",
  vehicleNumber: "",
  addressLine1: "",
  city: "",
  state: "",
  remarks: "",
};

export default function SingleEntrySection({
  token,
  banks,
  initialBankId = "",
  initialBranchName = "",
}) {
  const didApplyInitialSelection = useRef(false);

  useEffect(() => {
    didApplyInitialSelection.current = false;
  }, [initialBankId, initialBranchName]);

  const [selectedBankId, setSelectedBankId] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (didApplyInitialSelection.current) return;
    if (!initialBankId || !Array.isArray(banks) || banks.length === 0) return;
    const bank = banks.find((b) => String(b._id) === String(initialBankId));
    if (!bank) return;
    setSelectedBankId(bank._id);
    if (initialBranchName) {
      const norm = (s) => String(s || "").trim().toLowerCase();
      const br = (bank.branches || []).find(
        (x) => norm(x.name) === norm(initialBranchName)
      );
      if (br) setSelectedBranch(br.name);
    }
    didApplyInitialSelection.current = true;
  }, [initialBankId, initialBranchName, banks]);

  const selectedBank = useMemo(
    () => banks.find((b) => b._id === selectedBankId) || null,
    [banks, selectedBankId]
  );

  const activeBranches = useMemo(
    () => (selectedBank?.branches || []).filter((br) => br.isActive !== false),
    [selectedBank]
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "vehicleNumber" ? value.toUpperCase() : value,
    }));
  };

  const validate = () => {
    if (!selectedBank) return "Please select a bank.";
    if (!selectedBranch) return "Please select a branch.";
    if (!form.customerName.trim()) return "Customer name is required.";
    if (!form.mobileNumber.trim()) return "Mobile number is required.";
    if (!form.loanAccountNumber.trim()) return "Loan account number is required.";
    if (!form.vehicleNumber.trim()) return "Vehicle number is required.";
    if (!form.addressLine1.trim()) return "Address is required.";
    if (!form.city.trim()) return "City is required.";
    if (!form.state.trim()) return "State is required.";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        bankName: selectedBank.bankName,
        branchName: selectedBranch,
        customerName: form.customerName.trim(),
        mobileNumber: form.mobileNumber.trim(),
        alternateMobileNumber: form.alternateMobileNumber.trim() || undefined,
        loanAccountNumber: form.loanAccountNumber.trim(),
        vehicleNumber: form.vehicleNumber.trim(),
        addressLine1: form.addressLine1.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        remarks: form.remarks.trim(),
      };

      const response = await repoCaseService.createCase(payload, token);
      const createdCase = response?.data || null;

      setMessage(
        `Record created successfully${createdCase?.caseCode ? ` (${createdCase.caseCode})` : ""}`
      );
      setForm(initialForm);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create record");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ur-form-card">
      <form className="ur-form-grid" onSubmit={handleSubmit}>
        <label className="ur-form-row">
          <div className="ur-label">Bank *</div>
          <select
            value={selectedBankId}
            onChange={(e) => {
              setSelectedBankId(e.target.value);
              setSelectedBranch("");
            }}
          >
            <option value="">Select bank…</option>
            {banks.map((bank) => (
              <option key={bank._id} value={bank._id}>
                {bank.bankName}
              </option>
            ))}
          </select>
        </label>

        <label className="ur-form-row">
          <div className="ur-label">Branch *</div>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            disabled={!selectedBankId}
          >
            <option value="">Select branch…</option>
            {activeBranches.map((br) => (
              <option key={br._id} value={br.name}>
                {br.name}
              </option>
            ))}
          </select>
        </label>

        <label className="ur-form-row">
          <div className="ur-label">Customer Name *</div>
          <input
            name="customerName"
            value={form.customerName}
            onChange={handleChange}
            placeholder="Enter customer name"
          />
        </label>

        <label className="ur-form-row">
          <div className="ur-label">Mobile Number *</div>
          <input
            type="tel"
            name="mobileNumber"
            value={form.mobileNumber}
            onChange={handleChange}
            placeholder="Enter customer mobile"
          />
        </label>

        <label className="ur-form-row">
          <div className="ur-label">Alternate Mobile</div>
          <input
            type="tel"
            name="alternateMobileNumber"
            value={form.alternateMobileNumber}
            onChange={handleChange}
            placeholder="Optional second number"
          />
        </label>

        <label className="ur-form-row">
          <div className="ur-label">Loan Account Number *</div>
          <input
            name="loanAccountNumber"
            value={form.loanAccountNumber}
            onChange={handleChange}
            placeholder="Enter loan account number"
          />
        </label>

        <label className="ur-form-row">
          <div className="ur-label">Vehicle Number *</div>
          <input
            name="vehicleNumber"
            value={form.vehicleNumber}
            onChange={handleChange}
            placeholder="Enter vehicle number"
          />
        </label>

        <label className="ur-form-row ur-form-row-full">
          <div className="ur-label">Address *</div>
          <input
            name="addressLine1"
            value={form.addressLine1}
            onChange={handleChange}
            placeholder="Enter address"
          />
        </label>

        <label className="ur-form-row">
          <div className="ur-label">City *</div>
          <input
            name="city"
            value={form.city}
            onChange={handleChange}
            placeholder="Enter city"
          />
        </label>

        <label className="ur-form-row">
          <div className="ur-label">State *</div>
          <input
            name="state"
            value={form.state}
            onChange={handleChange}
            placeholder="Enter state"
          />
        </label>

        <label className="ur-form-row ur-form-row-full">
          <div className="ur-label">Remarks</div>
          <textarea
            name="remarks"
            value={form.remarks}
            onChange={handleChange}
            placeholder="Enter remarks"
            rows="4"
          />
        </label>

        {error && <p className="ur-feedback ur-error">{error}</p>}
        {message && <p className="ur-feedback ur-success">{message}</p>}

        <div className="ur-form-actions">
          <button
            type="button"
            className="ur-btn ur-btn-secondary"
            onClick={() => {
              setForm(initialForm);
              setSelectedBankId("");
              setSelectedBranch("");
              setError("");
              setMessage("");
            }}
            disabled={loading}
          >
            Reset
          </button>
          <button type="submit" className="ur-btn ur-btn-primary" disabled={loading}>
            {loading ? "Saving…" : "Save Record"}
          </button>
        </div>
      </form>
    </div>
  );
}
