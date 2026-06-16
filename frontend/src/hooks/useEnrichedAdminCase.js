import { useEffect, useState } from "react";
import { enrichCaseWithBankerFields } from "../utils/enrichCaseBankerFields";

/**
 * Merge full uploaded Excel row + column order onto a case/search item (repo admin).
 */
export function useEnrichedAdminCase(caseData, { token, caseId = null, enabled = true } = {}) {
  const [enriched, setEnriched] = useState(caseData);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !token || !caseData) {
      setEnriched(caseData ?? null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setEnriched(caseData);
    setLoading(true);

    const enrichTimeout = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 12000);

    enrichCaseWithBankerFields(caseData, token, caseId || caseData._id || caseData.id)
      .then((next) => {
        if (!cancelled) setEnriched(next || caseData);
      })
      .finally(() => {
        clearTimeout(enrichTimeout);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [caseData, token, caseId, enabled]);

  return { enrichedCase: enriched, enriching: loading };
}
