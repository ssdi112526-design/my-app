export default function ConfirmationFilterTabs({ tabs, activeKey, onChange, disabled }) {
  return (
    <div className="cf-filter-tabs" role="tablist" aria-label="Filter confirmations">
      {tabs.map((tab) => {
        const active = activeKey === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={`cf-filter-tab${active ? " cf-filter-tab--active" : ""}`}
            disabled={disabled}
            onClick={() => onChange(tab.key)}
          >
            <span className="cf-filter-tab__label">{tab.label}</span>
            {typeof tab.count === "number" ? (
              <span className="cf-filter-tab__count">{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
