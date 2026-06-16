import { useCallback, useEffect, useState } from "react";
import { repoCaseService } from "../services/repoCase.service";
import { filterValidVehicleRecords } from "../utils/vehicleNumberUtils";
import { getItems } from "../pages/repo/vehicles/findVehiclesHelpers";
import { compareLabels } from "../utils/sortByLabel";

const PAGE_SIZE = 500;
const MAX_PAGES = 50;

export default function useVehicleCatalog(token) {
  const [allVehicles, setAllVehicles] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(Boolean(token));
  const [error, setError] = useState("");

  const loadAllVehicles = useCallback(async () => {
    if (!token) {
      setLoadingCatalog(false);
      setAllVehicles([]);
      return;
    }

    try {
      setLoadingCatalog(true);
      let page = 1;
      let total = Infinity;
      const collected = [];

      while (collected.length < total) {
        const res = await repoCaseService.getCases(token, {
          page,
          limit: PAGE_SIZE,
          hasVehicleNumber: true,
        });
        const batch = filterValidVehicleRecords(getItems(res));
        total = Number(res?.total) || batch.length;
        collected.push(...batch);

        if (batch.length < PAGE_SIZE) break;
        page += 1;
        if (page > MAX_PAGES) break;
      }

      const seen = new Set();
      const unique = collected.filter((item) => {
        if (seen.has(item.vehicleNumber)) return false;
        seen.add(item.vehicleNumber);
        return true;
      });

      unique.sort((a, b) => compareLabels(a.vehicleNumber, b.vehicleNumber));
      setAllVehicles(unique);
      setError("");
    } catch (err) {
      const msg = err?.response?.data?.message || "";
      if (err?.response?.status === 403) {
        setError(
          msg ||
            "Forbidden — your role cannot read company cases. Sign in via Repo Agent (field login) or ask admin to restart the API server."
        );
      } else {
        setError(msg || "Failed to load vehicle records");
      }
      setAllVehicles([]);
    } finally {
      setLoadingCatalog(false);
    }
  }, [token]);

  useEffect(() => {
    loadAllVehicles();
  }, [loadAllVehicles]);

  return { allVehicles, loadingCatalog, error, reloadCatalog: loadAllVehicles };
}
