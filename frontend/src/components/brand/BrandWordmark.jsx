/** Shared FastRecovery wordmark — use with styles/brand.css */
export default function BrandWordmark({ suffix, className = "", as: Tag = "span" }) {
  return (
    <Tag className={`brand-wordmark ${className}`.trim()}>
      <span className="brand-fast">Fast</span>
      <span className="brand-recovery">Recovery</span>
      {suffix ? <span className="brand-suffix">{suffix}</span> : null}
    </Tag>
  );
}
