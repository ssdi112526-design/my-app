import "../../styles/dashboard.css";

const ADMIN_ITEMS = [
  { key: "records", label: "Uploaded records", statKey: "cases" },
  { key: "pending", label: "Pending confirmations", statKey: "pendingConfirmations" },
  { key: "confirmations", label: "Confirmed cases", statKey: "confirmations" },
  { key: "inventory", label: "Inventory confirmed", statKey: "inventoryConfirmed" },
];

const FIELD_USER_ITEMS = [
  { key: "pending", label: "Pending confirmations", statKey: "pendingConfirmations" },
  { key: "confirmations", label: "Confirmed cases", statKey: "confirmations" },
  { key: "inventory", label: "Inventory confirmed", statKey: "inventoryConfirmed" },
];

export default function DashboardStatsBar({
  stats,
  loading,
  activeKey,
  onStatClick,
  className = "",
  trailingItems = [],
  variant = "admin",
}) {
  const baseItems = variant === "field" ? FIELD_USER_ITEMS : ADMIN_ITEMS;
  const items = [
    ...baseItems.map((item) => ({
      key: item.key,
      label: item.label,
      value: stats[item.statKey] ?? 0,
    })),
    ...trailingItems,
  ];

  const barClass =
    variant === "field"
      ? "stats stats-single-row dashboard-stats-bar dashboard-stats-bar--field-user"
      : "stats stats-single-row dashboard-stats-bar";

  return (
    <div className={`${barClass} ${className}`.trim()}>
      {items.map((item) => {
        const clickable = typeof onStatClick === "function";
        const active = activeKey === item.key;
        const Tag = clickable ? "button" : "div";

        return (
          <Tag
            key={item.key}
            type={clickable ? "button" : undefined}
            className={`stat${active ? " stat--active" : ""}${clickable ? " stat--clickable" : ""}`}
            onClick={clickable ? () => onStatClick(item.key) : undefined}
          >
            <div className="stat-value">{loading ? "…" : item.value}</div>
            <div className="stat-label">{item.label}</div>
          </Tag>
        );
      })}
    </div>
  );
}
