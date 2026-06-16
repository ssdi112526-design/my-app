export const DEMO_TRACE_NOTE =
  "Demo trace: vehicle spotted at customer address. Team confirmed registration number matches Excel file. Ready for admin review.";

export async function buildDemoTraceSubmission() {
  return {
    note: DEMO_TRACE_NOTE,
  };
}
