import AppFooter from "../../components/layout/AppFooter";
import NotFound from "./NotFound";
import "../../styles/footer.css";

export default function NotFoundPage() {
  return (
    <div className="public-page-shell">
      <div className="public-page-main">
        <NotFound />
      </div>
      <AppFooter />
    </div>
  );
}
