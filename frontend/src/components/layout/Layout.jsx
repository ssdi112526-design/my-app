import Sidebar from "./Sidebar";
import RepoPanelHeader from "./RepoPanelHeader";
import PanelLayout from "./PanelLayout";
import AgencyWelcomeBrand from "./AgencyWelcomeBrand";
import FieldLocationPrompt from "../tracking/FieldLocationPrompt";
import FieldLocationTracker from "../tracking/FieldLocationTracker";

export default function Layout() {
  return (
    <>
      <FieldLocationPrompt />
      <FieldLocationTracker />
      <PanelLayout
      brand={<AgencyWelcomeBrand className="agency-welcome--mobile" />}
      sidebar={<Sidebar />}
      header={<RepoPanelHeader />}
      />
    </>
  );
}
