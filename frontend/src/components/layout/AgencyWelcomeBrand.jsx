import { useState } from "react";
import { FiCheck, FiCopy } from "react-icons/fi";
import useAgencyWelcome from "../../hooks/useAgencyWelcome";
import "../../styles/agency-welcome.css";

export default function AgencyWelcomeBrand({ className = "" }) {
  const { agencyName, companyCode, welcomeTitle } = useAgencyWelcome();
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!companyCode) return;

    try {
      await navigator.clipboard.writeText(companyCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert(`Company code: ${companyCode}`);
    }
  };

  if (!agencyName) {
    return <div className={`agency-welcome ${className}`.trim()}>Welcome</div>;
  }

  return (
    <div className={`agency-welcome ${className}`.trim()} title={welcomeTitle}>
      <span className="agency-welcome__lead">
        <span className="agency-welcome__prefix">Welcome,</span>{" "}
        <span className="agency-welcome__name">{agencyName}</span>
      </span>
      {companyCode ? (
        <button
          type="button"
          className="agency-welcome__code"
          onClick={handleCopyCode}
          title={copied ? "Copied" : "Click to copy company code"}
        >
          {companyCode}
          <span className="agency-welcome__copy" aria-hidden>
            {copied ? <FiCheck /> : <FiCopy />}
          </span>
        </button>
      ) : null}
    </div>
  );
}
