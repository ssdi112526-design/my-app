/** Opens the browser print dialog for list/table pages. */
export function printTablePage() {
  const previousTitle = document.title;
  document.title = `${previousTitle} — Print`;

  const cleanup = () => {
    document.title = previousTitle;
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup);
  window.print();
}
