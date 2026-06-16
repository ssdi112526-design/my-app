import { useCallback, useEffect, useState } from "react";
import useAuth from "./useAuth";
import repoAdminService from "../services/repoAdmin.service";

/**
 * Agency name + company code for repo panel chrome (sidebar, mobile bar, dashboard).
 */
export default function useAgencyWelcome() {
  const { auth } = useAuth();
  const [agencyName, setAgencyName] = useState(
    auth?.user?.company?.companyName || ""
  );
  const [companyCode, setCompanyCode] = useState(
    auth?.user?.company?.companyCode || ""
  );

  const applySnapshot = useCallback((snapshot) => {
    if (!snapshot) return;
    if (snapshot.companyName) {
      setAgencyName(String(snapshot.companyName).trim());
    }
    if (snapshot.companyCode) {
      setCompanyCode(String(snapshot.companyCode).trim());
    }
  }, []);

  const loadAgency = useCallback(async () => {
    const fromAuth = auth?.user?.company;
    if (fromAuth?.companyName || fromAuth?.companyCode) {
      applySnapshot(fromAuth);
    }

    if (
      auth?.user?.role !== "REPO_ADMIN" ||
      !auth?.token ||
      !auth?.user?.companyId
    ) {
      return;
    }

    if (fromAuth?.companyName && fromAuth?.companyCode) {
      return;
    }

    try {
      const res = await repoAdminService.getMyCompany(auth.token);
      const data = res?.data || res;
      applySnapshot(data);
    } catch {
      /* keep cached / empty */
    }
  }, [
    applySnapshot,
    auth?.token,
    auth?.user?.company,
    auth?.user?.companyId,
    auth?.user?.role,
  ]);

  useEffect(() => {
    loadAgency();
  }, [loadAgency]);

  const welcomeTitle = agencyName
    ? companyCode
      ? `Welcome, ${agencyName} ${companyCode}`
      : `Welcome, ${agencyName}`
    : "Welcome";

  return { agencyName, companyCode, welcomeTitle };
}
