export default function AuthBootScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f7fb",
        color: "#334155",
        fontFamily: "inherit",
      }}
    >
      Restoring session…
    </div>
  );
}
