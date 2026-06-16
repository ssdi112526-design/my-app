import SsdiSidebar from "./SsdiSidebar";
import Header from "./Header";
import PanelLayout from "./PanelLayout";
import { BRAND_NAME } from "../../constants/brand";

export default function SsdiLayout() {
  return (
    <PanelLayout
      brand={BRAND_NAME}
      sidebar={<SsdiSidebar />}
      header={<Header />}
    />
  );
}
