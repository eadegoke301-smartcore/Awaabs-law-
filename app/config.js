const config = {
  deadlines: {
    // Defaults aligned with current Awaab's Law policy intent in England
    // Adjust as regulations evolve or for your local policy
    investigateDays: Number(process.env.AWAABS_LAW_INVESTIGATE_DAYS || 14),
    startRepairsDays: Number(process.env.AWAABS_LAW_START_REPAIRS_DAYS || 7),
    emergencyHours: Number(process.env.AWAABS_LAW_EMERGENCY_HOURS || 24)
  },
  app: {
    port: Number(process.env.PORT || 3000),
    baseUrl: process.env.BASE_URL || ""
  },
  disclaimers: {
    awaabsLaw:
      "This tool helps residents report damp and mould. It is not legal advice. Timelines are indicative and may differ based on final regulations and local policy.",
    privacy:
      "By submitting, you consent to store your data for case handling. Share with your landlord or local authority only with your consent."
  }
};

module.exports = config;
