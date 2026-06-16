import BankSidebar from "./BankSidebar";
import Header from "./Header";
import PanelLayout from "./PanelLayout";

export default function BankLayout() {
  return (
    <PanelLayout
      brand="Bank Panel"
      sidebar={<BankSidebar />}
      header={<Header />}
    />
  );
}
