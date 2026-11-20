const lowIncomeRanges = new Set(["Below ₹1 lakh", "₹1–2.5 lakh"]);

const guidanceByScheme = {
  health: {
    checks: [
      "Check the applicable household beneficiary list and state-specific PM-JAY rules.",
      "Confirm eligibility through the official beneficiary portal or local health authority.",
    ],
  },
  housing: {
    checks: [
      "Identify whether PMAY-Urban or PMAY-Gramin applies to your household.",
      "Verify home-ownership, household, location, and prior-assistance conditions with the official scheme.",
    ],
  },
  farmers: {
    checks: [
      "Verify eligible cultivable land and land records for the farmer family.",
      "Check scheme exclusions, registration requirements, and e-KYC on the official portal.",
    ],
  },
  education: {
    checks: [
      "Select a specific scholarship; the National Scholarship Portal lists multiple programmes.",
      "Check that scholarship's course, institution, academic, income, category, and deadline rules.",
    ],
  },
  "women-child": {
    checks: [
      "Confirm the current PMMVY conditions and registration timeline with the official portal or local Anganwadi/health worker.",
      "Check which identity, pregnancy/birth and payment documents are required for your case.",
    ],
  },
  employment: {
    checks: [
      "Confirm rural-household and local job-card requirements with your Gram Panchayat.",
      "Follow the local process to register and request work.",
    ],
  },
  pension: {
    checks: [
      "Check current age and household criteria under NSAP and your state/UT rules.",
      "Ask the local social-welfare office which application channel and documents apply.",
    ],
  },
  financial: {
    checks: [
      "Confirm street-vending status and local-body verification for PM SVANidhi.",
      "Review current loan terms and repayment obligations before applying.",
    ],
  },
};

export function evaluateSchemeEligibility(schemeId, profile = {}) {
  const relevanceReasons = [];
  let relevanceScore = 0;

  switch (schemeId) {
    case "health":
      if (profile.age === "60 or above") {
        relevanceScore += 1;
        relevanceReasons.push(
          "Your age group may help prioritize health-support exploration, but it does not establish PM-JAY eligibility.",
        );
      }
      break;
    case "housing":
      if (lowIncomeRanges.has(profile.householdIncome)) {
        relevanceScore += 2;
        relevanceReasons.push(
          "The income range may help prioritize housing-support exploration; PMAY eligibility also depends on the applicable component and household conditions.",
        );
      }
      if (profile.familySize === "5" || profile.familySize === "6 or more") {
        relevanceScore += 1;
        relevanceReasons.push(
          "Household size is included as context only and does not determine PMAY eligibility.",
        );
      }
      break;
    case "farmers":
      if (profile.occupation === "Farmer") {
        relevanceScore += 4;
        relevanceReasons.push(
          "Farmer occupation is a broad PM-KISAN exploration signal; it does not confirm landholding or scheme eligibility.",
        );
      }
      break;
    case "education":
      if (profile.occupation === "Student") {
        relevanceScore += 4;
        relevanceReasons.push(
          "Student occupation is a broad scholarship exploration signal; each scholarship has its own criteria.",
        );
      }
      if (profile.socialCategory) {
        relevanceScore += 1;
        relevanceReasons.push(
          "Your social category is included as context because some scholarships have category-specific requirements.",
        );
      }
      if (lowIncomeRanges.has(profile.householdIncome)) {
        relevanceScore += 1;
        relevanceReasons.push(
          "Your reported income range may matter for some scholarships; each scholarship has its own rules.",
        );
      }
      break;
    case "women-child":
      if (profile.gender === "Woman") {
        relevanceScore += 1;
        relevanceReasons.push(
          "Gender alone does not establish PMMVY eligibility; pregnancy, registration timing and other current conditions must be checked.",
        );
      }
      break;
    case "employment":
      if (["Looking for work", "Wage worker"].includes(profile.occupation)) {
        relevanceScore += 2;
        relevanceReasons.push(
          "Your occupation may make employment support worth exploring; MGNREGA applies to eligible rural households and requires local registration.",
        );
      }
      break;
    case "pension":
      if (profile.age === "60 or above") {
        relevanceScore += 2;
        relevanceReasons.push(
          "Your age group may make pension support worth exploring; exact age, household criteria and state/UT rules need verification.",
        );
      }
      break;
    case "financial":
      if (profile.occupation === "Self-employed") {
        relevanceScore += 2;
        relevanceReasons.push(
          "Self-employment is a broad signal only; PM SVANidhi is for eligible street vendors and requires local verification.",
        );
      }
      break;
    default:
      return {
        status: "needs-verification",
        relevanceScore: 0,
        relevanceReasons: ["No screening guidance is configured for this scheme yet."],
        checks: ["Check the official scheme source for current eligibility conditions."],
      };
  }

  return {
    status: relevanceReasons.length ? "possible" : "needs-verification",
    relevanceScore,
    relevanceReasons: relevanceReasons.length
      ? relevanceReasons
      : [
          "The details provided are not enough to identify a profile match. This is not a rejection; another household member or additional information may be relevant.",
        ],
    checks: guidanceByScheme[schemeId].checks,
  };
}

export function getEligibilityStatusLabel(status) {
  switch (status) {
    case "eligible":
      return "Eligible";
    case "not-eligible":
      return "Not eligible";
    case "possible":
      return "Possibly eligible · needs verification";
    default:
      return "Needs verification";
  }
}
