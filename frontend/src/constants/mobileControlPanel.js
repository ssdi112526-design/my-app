import {
  FiSearch,
  FiUpload,
  FiUser,
  FiList,
  FiFileText,
  FiCreditCard,
  FiUserX,
  FiSettings,
  FiLock,
  FiSmartphone,
  FiShield,
  FiMapPin,
  FiBookOpen,
} from "react-icons/fi";

/** Cards on the Control Panel page (mobile admin tools — not in sidebar). */
export const CONTROL_PANEL_CARDS = [
  { to: "/find-vehicles", title: "Find Vehicles", desc: "Search uploaded data", icon: FiSearch },
  { to: "/bank-details", title: "Upload Records", desc: "Banks, branches & Excel", icon: FiUpload },
  { to: "/users", title: "Users", desc: "Team & roles", icon: FiUser },
  { to: "/blacklist", title: "Blacklist", desc: "Blocked entries", icon: FiUserX },
  { to: "/otps", title: "OTP", desc: "OTP logs & settings", icon: FiLock },
  { to: "/plans", title: "Recharge", desc: "Plans & subscription top-up", icon: FiCreditCard },
  {
    to: "/profile",
    title: "Profile",
    desc: "Firm/agency details, contact & password",
    icon: FiSmartphone,
  },
  {
    to: "/field-map",
    title: "Field Map",
    desc: "Watch tracers live on map",
    icon: FiMapPin,
  },
  {
    to: "/live-tracking",
    title: "Device Permission",
    desc: "GPS & location access",
    icon: FiShield,
  },
  { to: "/cases", title: "Cases", desc: "Case list", icon: FiList },
  { to: "/reports", title: "Reports", desc: "Exports", icon: FiFileText },
  { to: "/finances", title: "Partner Banks", desc: "Banks connected to your agency", icon: FiBookOpen },
  { to: "/clean-file", title: "Clean File", desc: "Data cleanup", icon: FiSettings },
];

/** Mobile sidebar for repo admin — admin tools open from Control Panel page. */
export const MOBILE_ADMIN_SIDEBAR_PATHS = [
  "/home",
  "/control-panel",
  "/profile",
  "/id-card",
  "/feedback",
];
