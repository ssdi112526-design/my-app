import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "../components/auth/ProtectedRoute";
import GuestRoute from "../components/auth/GuestRoute";

import Layout from "../components/layout/Layout";
import ControlPanelGuard from "../components/auth/ControlPanelGuard";
import SsdiLayout from "../components/layout/SsdiLayout";
import BankLayout from "../components/layout/BankLayout";
import PublicPageShell from "../components/layout/PublicPageShell";

import Login from "../pages/auth/Login";
import SsdiLogin from "../pages/auth/SsdiLogin";
import RepoAdminLogin from "../pages/auth/RepoAdminLogin";
import RepoAgentLogin from "../pages/auth/RepoAgentLogin";
import ForgotPassword from "../pages/auth/ForgotPassword";
import ApkRegisterHub from "../pages/auth/ApkRegisterHub";
import RegisterCompany from "../pages/auth/RegisterCompany";
import AgentRegister from "../pages/auth/AgentRegister";

import ProductsPage from "../pages/marketing/ProductsPage";
import FaqsPage from "../pages/marketing/FaqsPage";
import AboutPage from "../pages/marketing/AboutPage";
import ServicesPage from "../pages/marketing/ServicesPage";
import ContactPage from "../pages/marketing/ContactPage";

import Home from "../pages/repo/dashboard/Home";
import FindVehicles from "../pages/repo/vehicles/FindVehicles";
import FindVehiclesResults from "../pages/repo/vehicles/FindVehiclesResults";
import VehicleTrace from "../pages/repo/vehicles/VehicleTrace";
import Reports from "../pages/repo/reports/Reports";
import ConfirmedCasesReport from "../pages/repo/reports/ConfirmedCasesReport";
import Users from "../pages/repo/users/Users";
import CreateUser from "../pages/repo/users/CreateUser";
import UserDetails from "../pages/repo/users/UserDetails";
import MyProfile from "../pages/repo/profile/MyProfile";
import IdCard from "../pages/repo/profile/IdCard";
import BankDetails from "../pages/repo/banks/BankDetails";
import ControlPanel from "../pages/repo/controlPanel/ControlPanel";
import OTPs from "../pages/repo/otps/OTPs";
import DetailsView from "../pages/repo/details/DetailsView";
import Blacklist from "../pages/repo/blacklist/Blacklist";
import Confirmation from "../pages/repo/confirmation/Confirmation";
import ConfirmationView from "../pages/repo/confirmation/ConfirmationView";
import InventoryUpdate from "../pages/repo/inventory/InventoryUpdate";
import Feedback from "../pages/repo/feedback/Feedback";
import Finances from "../pages/repo/finances/Finances";
import CleanFile from "../pages/repo/cleanFile/CleanFile";
import RepoPlans from "../pages/repo/plans/RepoPlans";
import CasesList from "../pages/repo/cases/CasesList";
import LiveTracking from "../pages/repo/tracking/LiveTracking";
import FieldMap from "../pages/repo/tracking/FieldMap";

import SsdiDashboard from "../pages/ssdi/dashboard/SsdiDashboard";
import SsdiCompanies from "../pages/ssdi/companies/SsdiCompanies";
import SsdiCreateCompany from "../pages/ssdi/companies/SsdiCreateCompany";
import SsdiCompanyDetails from "../pages/ssdi/companies/SsdiCompanyDetails";
import SsdiRegistrations from "../pages/ssdi/registrations/SsdiRegistrations";
import SsdiPlans from "../pages/ssdi/plans/SsdiPlans";
import SsdiPayments from "../pages/ssdi/payments/SsdiPayments";
import SsdiBlacklist from "../pages/ssdi/blacklist/SsdiBlacklist";
import SsdiConfirmations from "../pages/ssdi/confirmations/SsdiConfirmations";
import SsdiFeedbacks from "../pages/ssdi/feedbacks/SsdiFeedbacks";
import SsdiBanks from "../pages/ssdi/banks/SsdiBanks";
import SsdiCreateBank from "../pages/ssdi/banks/SsdiCreateBank";
import SsdiBankDetails from "../pages/ssdi/banks/SsdiBankDetails";

import BankLogin from "../pages/bank/auth/BankLogin";
import BankRegister from "../pages/bank/auth/BankRegister";
import BankDashboard from "../pages/bank/dashboard/BankDashboard";
import BankPersons from "../pages/bank/persons/BankPersons";
import BankRecords from "../pages/bank/records/BankRecords";
import BankUploadFiles from "../pages/bank/files/BankUploadFiles";
import BankTracing from "../pages/bank/tracing/BankTracing";
import LinkedBankRecords from "../pages/repo/bankRecords/LinkedBankRecords";

import NotFoundPage from "../pages/shared/NotFoundPage";
import Unauthorized from "../pages/shared/Unauthorized";
export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicPageShell />}>
        <Route element={<GuestRoute />}>
          <Route path="/" element={<Login />} />
          <Route path="/ssdi/login" element={<SsdiLogin />} />
          <Route path="/repo-admin/login" element={<RepoAdminLogin />} />
          <Route path="/repo-agent/login" element={<RepoAgentLogin />} />
          <Route path="/bank/login" element={<BankLogin />} />
        </Route>
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/register" element={<ApkRegisterHub />} />
        <Route path="/register-company" element={<RegisterCompany />} />
        <Route path="/agent-register" element={<AgentRegister />} />
        <Route path="/bank/register" element={<BankRegister />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/faqs" element={<FaqsPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
      </Route>
      <Route
        element={
          <ProtectedRoute
            allowedRoles={[
              "REPO_ADMIN",
              "TEAM_LEADER",
              "HEAD_OFFICE_STAFF",
              "OFFICE_STAFF",
              "REPO_STAFF",
              "REPO_VIEWER",
            ]}
          />
        }
      >
        <Route element={<Layout />}>
          <Route element={<ControlPanelGuard />}>
            <Route path="/home" element={<Home />} />
            <Route path="/control-panel" element={<ControlPanel />} />
            <Route path="/cases" element={<CasesList />} />
            <Route path="/live-tracking" element={<LiveTracking />} />
            <Route path="/field-map" element={<FieldMap />} />
            <Route path="/find-vehicles" element={<FindVehicles />} />
            <Route path="/find-vehicles/results" element={<FindVehiclesResults />} />
            <Route path="/vehicle-trace" element={<VehicleTrace />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/confirmed-cases" element={<ConfirmedCasesReport />} />
            <Route
              path="/reports/inventory-uploaded"
              element={<Navigate to="/reports/confirmed-cases" replace />}
            />
            <Route path="/users" element={<Users />} />
            <Route path="/users/create" element={<CreateUser />} />
            <Route path="/users/:id" element={<UserDetails />} />
            <Route path="/profile" element={<MyProfile />} />
            <Route path="/id-card" element={<IdCard />} />
            <Route path="/bank-details" element={<BankDetails />} />
            <Route path="/bank-records" element={<LinkedBankRecords />} />
            <Route path="/upload-records" element={<Navigate to="/bank-details" replace />} />
            <Route path="/otps" element={<OTPs />} />
            <Route path="/details-view" element={<DetailsView />} />
            <Route path="/blacklist" element={<Blacklist />} />
            <Route path="/confirmation/:id" element={<ConfirmationView />} />
            <Route path="/confirmation" element={<Confirmation />} />
            <Route path="/inventory-update" element={<InventoryUpdate />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/finances" element={<Finances />} />
            <Route path="/clean-file" element={<CleanFile />} />
            <Route path="/plans" element={<RepoPlans />} />
          </Route>
        </Route>
      </Route>

      <Route
        element={<ProtectedRoute allowedRoles={["SSDI_SUPER_ADMIN"]} />}
      >
        <Route path="/ssdi" element={<SsdiLayout />}>
          <Route index element={<Navigate to="/ssdi/dashboard" replace />} />
          <Route path="dashboard" element={<SsdiDashboard />} />
          <Route path="companies" element={<SsdiCompanies />} />
          <Route path="companies/create" element={<SsdiCreateCompany />} />
          <Route path="companies/:id" element={<SsdiCompanyDetails />} />
          <Route path="registrations" element={<SsdiRegistrations />} />
          <Route path="plans" element={<SsdiPlans />} />
          <Route path="payments" element={<SsdiPayments />} />
          <Route path="blacklist" element={<SsdiBlacklist />} />
          <Route path="confirmations" element={<SsdiConfirmations />} />
          <Route path="feedbacks" element={<SsdiFeedbacks />} />
          <Route path="banks" element={<SsdiBanks />} />
          <Route path="banks/create" element={<SsdiCreateBank />} />
          <Route path="banks/:id" element={<SsdiBankDetails />} />
        </Route>
      </Route>

      {/* ── Bank Panel ── */}
      <Route
        element={<ProtectedRoute allowedRoles={["BANK_ADMIN", "BANK_PERSON"]} />}
      >
        <Route path="/bank" element={<BankLayout />}>
          <Route index element={<Navigate to="/bank/dashboard" replace />} />
          <Route path="dashboard" element={<BankDashboard />} />
          <Route path="files" element={<BankUploadFiles />} />
          <Route path="records" element={<BankRecords />} />
          <Route path="tracing" element={<BankTracing />} />
          <Route path="persons" element={<BankPersons />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}