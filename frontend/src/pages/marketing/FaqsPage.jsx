import { useState } from "react";
import { Link } from "react-router-dom";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import MarketingPageLayout from "../../components/marketing/MarketingPageLayout";
import "../../styles/auth.css";

const FAQS = [
  {
    q: "What is Fast Recovery?",
    a: "Fast Recovery is a SaaS platform for loan repossession agencies, banks, and field tracers. It connects all parties in the recovery chain — bank uploads data, agency assigns cases, tracers work in the field.",
  },
  {
    q: "How does a bank connect with an agency?",
    a: "SSDI (our admin team) manually creates the link between a bank and an agency after both are registered on the platform. Once linked, the agency can see the bank's uploaded recovery data.",
  },
  {
    q: "Is the data secure?",
    a: "Yes. Every record is tagged to the bank and uploader. Agencies only see data from banks linked to them. Tracers only see cases assigned to them. All data is stored in MongoDB Atlas with JWT-secured APIs.",
  },
  {
    q: "How do I upload recovery data as a bank?",
    a: "Log into the Bank Panel and go to Records. Upload your Excel file — it goes directly to AWS S3 and is processed in the background. Files with 400,000+ rows are fully supported.",
  },
  {
    q: "How do I register my agency?",
    a: "Contact SSDI or register via the APK register link on the home page. SSDI activates your account after verifying payment.",
  },
  {
    q: "What file formats are supported for upload?",
    a: "Excel files (.xlsx and .xls) are supported. The system automatically maps common column names like 'Registration Numbers', 'Loan Number', 'Mobile No', etc.",
  },
  {
    q: "How do I contact support?",
    a: "Call 9654008400 or email us. You can also use the Contact Us page.",
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="marketing-faq-item">
      <button
        type="button"
        className="marketing-faq-item__trigger"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {q}
        {open ? <FiChevronUp aria-hidden /> : <FiChevronDown aria-hidden />}
      </button>
      {open && <p className="marketing-faq-item__answer">{a}</p>}
    </div>
  );
}

export default function FaqsPage() {
  return (
    <MarketingPageLayout narrow>
      <header className="marketing-page__hero">
        <h1 className="marketing-page__title">Frequently Asked Questions</h1>
        <p className="marketing-page__lead">Everything you need to know about Fast Recovery.</p>
      </header>

      <div className="marketing-faq-list">
        {FAQS.map((f) => (
          <FaqItem key={f.q} q={f.q} a={f.a} />
        ))}
      </div>

      <div className="marketing-page__actions">
        <Link to="/" className="primary-page-btn">
          ← Back to Login
        </Link>
      </div>
    </MarketingPageLayout>
  );
}
