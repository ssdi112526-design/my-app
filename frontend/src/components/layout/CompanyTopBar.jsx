import { useEffect, useState } from "react";
import useAuth from "../../hooks/useAuth";
import { isRepoUser } from "../../utils/permissions";
import repoAdminService from "../../services/repoAdmin.service";
import { getStoredAuth, setStoredAuth } from "../../utils/storage";
import "../../styles/company-top-bar.css";

export default function CompanyTopBar() {
  const { auth, setAuth } = useAuth();
  const [company, setCompany] = useState(auth?.user?.company || null);

  useEffect(() => {
    const fromAuth = auth?.user?.company;
    if (fromAuth?.companyName) {
      setCompany(fromAuth);
      return undefined;
    }

    if (!auth?.token || !isRepoUser(auth?.user?.role) || !auth?.user?.companyId) {
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const res = await repoAdminService.getMyCompany(auth.token);
        const data = res?.data || res;
        if (cancelled || !data?.companyName) return;

        const snapshot = {
          companyName: data.companyName,
          companyCode: data.companyCode,
        };

        setCompany(snapshot);

        const saved = getStoredAuth();
        if (saved?.user) {
          const next = {
            ...saved,
            user: { ...saved.user, company: snapshot },
          };
          setStoredAuth(next);
          setAuth((prev) => ({
            ...prev,
            user: { ...prev.user, company: snapshot },
          }));
        }
      } catch {
        if (!cancelled) setCompany(null);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [auth?.token, auth?.user?.role, auth?.user?.companyId, auth?.user?.company, setAuth]);

  if (!isRepoUser(auth?.user?.role) || !company?.companyName) {
    return null;
  }

  return (
    <div className="company-top-bar" role="banner">
      <div className="company-top-bar-code-block">
        <span className="company-top-bar-label">Code</span>
        <strong className="company-top-bar-code">
          {company.companyCode || "—"}
        </strong>
      </div>

      <div className="company-top-bar-company-block">
        <span className="company-top-bar-label">Company</span>
        <strong className="company-top-bar-name">{company.companyName}</strong>
      </div>
    </div>
  );
}
