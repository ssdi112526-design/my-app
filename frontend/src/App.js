import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./Layout";

import Home from "./Home";
import FindVehicles from "./FindVehicles";
import Reports from "./Reports";
import Users from "./Users";
import CreateUser from "./CreateUser";
import UserDetails from "./UserDetails";
import CleanFile from "./CleanFile";
import Finances from "./Finances";
import UploadRecords from "./UploadRecords";
import OTPs from "./OTPs";
import DetailsView from "./DetailsView";
import Blacklist from "./Blacklist";
import Confirmation from "./Confirmation";
import Feedback from "./Feedback";
import Login from "./Login";
import ForgotPassword from "./ForgotPassword";
import CreateRepoCompany from "./CreateRepoCompany";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* AUTH PAGES (NO LAYOUT) */}
        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* APP PAGES (WITH LAYOUT) */}
        <Route element={<Layout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/find-vehicles" element={<FindVehicles />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/clean-file" element={<CleanFile />} />
          <Route path="/finances" element={<Finances />} />
          <Route path="/upload-records" element={<UploadRecords />} />
          <Route path="/otps" element={<OTPs />} />
          <Route path="/details-view" element={<DetailsView />} />
          <Route path="/confirmation" element={<Confirmation />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/ssdi/create-repo" element={<CreateRepoCompany />} />

          {/* USER SYSTEM */}
          <Route path="/users" element={<Users />} />
          <Route path="/users/create" element={<CreateUser />} />
          <Route path="/users/:id" element={<UserDetails />} />
          <Route path="/blacklist" element={<Blacklist />} />
        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;
