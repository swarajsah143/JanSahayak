import { evaluateSchemeEligibility } from "./eligibility.js";
import { schemes as defaultSchemes } from "./data/schemes.js";
import { localizeScheme, translate } from "./localization.js";

const aliasesByScheme = {
  health: ["pm jay", "pmjay", "ayushman", "आयुष्मान", "ಆಯುಷ್ಮಾನ್"],
  housing: ["pmay", "pm awas", "आवास योजना", "ವಸತಿ ಯೋಜನೆ"],
  farmers: ["pm kisan", "pmkisan", "kisan samman", "किसान सम्मान", "ಕಿಸಾನ್ ಸಮ್ಮಾನ್"],
  education: ["national scholarship portal", "scholarships portal", "छात्रवृत्ति पोर्टल", "ವಿದ್ಯಾರ್ಥಿವೇತನ ಪೋರ್ಟಲ್"],
  "women-child": ["pmmvy", "matru vandana", "मातृ वंदना", "ಮಾತೃ ವಂದನಾ"],
  employment: ["mgnrega", "nrega", "मनरेगा", "ನರೇಗಾ"],
  pension: ["ignoaps", "old age pension", "वृद्धावस्था पेंशन", "ವೃದ್ಧಾಪ್ಯ ಪಿಂಚಣಿ"],
  financial: ["svanidhi", "street vendor", "रेहड़ी", "फेरीवाला", "ಬೀದಿ ವ್ಯಾಪಾರಿ"],
};

const normalize = (value) =>
  value.toLocaleLowerCase().replace(/[\p{P}\p{S}]+/gu, " ").replace(/\s+/g, " ").trim();

const containsAny = (text, phrases) =>
  phrases.some((phrase) => text.includes(normalize(phrase)));

function findMentionedScheme(question, language, currentSchemeId, catalog) {
  const normalizedQuestion = normalize(question);
  const match = catalog.find((scheme) => {
    const localizedName = localizeScheme(scheme, language).name;
    const terms = [
      scheme.name,
      localizedName,
      scheme.id.replaceAll("-", " "),
      ...(aliasesByScheme[scheme.id] ?? []),
    ];
    return terms.some((term) => normalizedQuestion.includes(normalize(term)));
  });
  if (match) return match.id;

  const refersToCurrentScheme = containsAny(normalizedQuestion, [
    "this scheme",
    "that scheme",
    "this one",
    "that one",
    "its benefits",
    "its documents",
    "its deadline",
    "इस योजना",
    "उस योजना",
    "इसके दस्तावेज",
    "ಈ ಯೋಜನೆ",
    "ಆ ಯೋಜನೆ",
    "ಇದರ ದಾಖಲೆ",
  ]);
  return refersToCurrentScheme ? currentSchemeId : null;
}

function getTopicSchemeId(question) {
  const topics = [
    {
      id: "farmers",
      phrases: ["farmer", "farmers", "farming", "किसान", "खेती", "ರೈತ", "ಕೃಷಿ"],
    },
    {
      id: "education",
      phrases: ["scholarship", "engineering student", "engineering", "student", "छात्रवृत्ति", "इंजीनियरिंग", "विद्यार्थी", "ವಿದ್ಯಾರ್ಥಿವೇತನ", "ಇಂಜಿನಿಯರಿಂಗ್", "ವಿದ್ಯಾರ್ಥಿ"],
    },
    {
      id: "health",
      phrases: ["hospital", "healthcare", "medical treatment", "अस्पताल", "इलाज", "ಆಸ್ಪತ್ರೆ", "ಚಿಕಿತ್ಸೆ"],
    },
    {
      id: "housing",
      phrases: ["housing", "house", "home", "आवास", "घर", "ವಸತಿ", "ಮನೆ"],
    },
    {
      id: "employment",
      phrases: ["rural work", "job card", "employment", "रोज़गार", "काम", "मनरेगा", "ಉದ್ಯೋಗ", "ಕೆಲಸ", "ನರೇಗಾ"],
    },
    {
      id: "pension",
      phrases: ["pension", "old age", "बुज़ुर्ग", "पेंशन", "ವೃದ್ಧಾಪ್ಯ", "ಪಿಂಚಣಿ"],
    },
    {
      id: "financial",
      phrases: ["street vendor", "small business loan", "रेहड़ी", "फेरीवाला", "ಬೀದಿ ವ್ಯಾಪಾರಿ"],
    },
    {
      id: "women-child",
      phrases: ["maternity", "pregnant", "pregnancy", "गर्भवती", "मातृत्व", "ಗರ್ಭಿಣಿ", "ಮಾತೃತ್ವ"],
    },
  ];
  return topics.find(({ phrases }) => containsAny(question, phrases))?.id ?? null;
}

function getIntent(question) {
  const isDocumentQuestion = containsAny(question, [
    "document",
    "paperwork",
    "दस्तावेज",
    "कागज़",
    "कागज",
    "दस्तावेज़",
    "ದಾಖಲೆ",
    "ಪತ್ರ",
  ]);
  if (isDocumentQuestion) return "documents";

  if (containsAny(question, ["deadline", "last date", "अंतिम तारीख", "आखिरी तारीख", "ಕೊನೆಯ ದಿನಾಂಕ", "ಕೊನೆಯ ದಿನ"])) {
    return "deadline";
  }
  if (containsAny(question, ["contact", "helpline", "phone", "office", "संपर्क", "कार्यालय", "फोन", "ಕಚೇರಿ", "ಸಂಪರ್ಕ"])) {
    return "contact";
  }
  if (containsAny(question, ["how do i apply", "how to apply", "application process", "apply online", "steps to apply", "कैसे आवेदन", "आवेदन कैसे", "ಅರ್ಜಿ ಹೇಗೆ", "ಹೇಗೆ ಅರ್ಜಿ"])) {
    return "application";
  }
  if (containsAny(question, ["benefit", "benefits", "what do i get", "लाभ", "फायदा", "सहायता", "ನೆರವು", "ಪ್ರಯೋಜನ", "ಸಿಗುತ್ತದೆ"])) {
    return "benefits";
  }
  if (containsAny(question, ["eligible", "eligibility", "qualify", "can i apply", "पात्र", "पात्रता", "योग्य", "ಅರ್ಹ", "ಅರ್ಹತೆ"])) {
    return "eligibility";
  }
  return "overview";
}

function getProfileOccupation(schemeId) {
  if (schemeId === "farmers") return "Farmer";
  if (schemeId === "education") return "Student";
  if (schemeId === "employment") return "Looking for work";
  if (schemeId === "financial") return "Self-employed";
  return "";
}

export function answerSchemeQuestion(
  question,
  language = "en",
  currentSchemeId = null,
  catalog = defaultSchemes,
) {
  const t = (text) => translate(text, language);
  const normalizedQuestion = normalize(question);
  const isWidowQuestion = containsAny(normalizedQuestion, ["widow", "widows", "विधवा", "विधवाओं", "ವಿಧವೆ", "ವಿಧವೆಯ"]);
  const isScholarshipQuestion = containsAny(normalizedQuestion, [
    "scholarship",
    "scholarships",
    "छात्रवृत्ति",
    "छात्रवृत्तियाँ",
    "ವಿದ್ಯಾರ್ಥಿವೇತನ",
  ]);

  if (isWidowQuestion) {
    return {
      text: t("The scheme records do not include a confirmed widow-specific scheme. The old-age pension listed here has separate age and state rules; widow status alone does not establish eligibility. Contact your state or local social-welfare office for current widow support."),
      schemeIds: [],
    };
  }

  const mentionedSchemeId = findMentionedScheme(question, language, currentSchemeId, catalog);
  const suggestedTopicId = getTopicSchemeId(question);
  const topicSchemeId = catalog.some((scheme) => scheme.id === suggestedTopicId)
    ? suggestedTopicId
    : null;
  if (!mentionedSchemeId && isScholarshipQuestion) {
    const scholarshipRecord = catalog.find((scheme) => scheme.id === "education");
    if (!scholarshipRecord) {
      return {
        text: t("I don't have a scholarship listing in the current scheme catalog. Check the official National Scholarship Portal for current programmes."),
        schemeIds: [],
      };
    }
    const scholarship = localizeScheme(scholarshipRecord, language);
    return {
      text: `${t("I found a scholarship listing portal, not one single scholarship. Search its current list for engineering, then check that scholarship's course, institution, income and other rules.")}\n\n${t("I can't confirm eligibility from a chat message. The scheme authority checks the current rules and your full application.")}`,
      schemeIds: [scholarship.id],
    };
  }

  const schemeId = mentionedSchemeId ?? topicSchemeId;
  if (!schemeId) {
    return {
      text: t("I don't have enough details to suggest a scheme. Tell me your broad support need or situation, such as farming, study, health, housing, work, or pension."),
      schemeIds: [],
    };
  }

  const schemeRecord = catalog.find((scheme) => scheme.id === schemeId);
  const scheme = localizeScheme(schemeRecord, language);
  const intent = getIntent(normalizedQuestion);

  if (intent === "documents") {
    const documentList = scheme.requiredDocuments
      .map((document) => `- ${document.name}: ${document.whereToGet}`)
      .join("\n");
    return {
      text: `${scheme.name}\n${t("The scheme record suggests these documents to check:")}\n${documentList}\n\n${t("This document list is indicative. Confirm the exact list with the official scheme before collecting or submitting documents.")}`,
      schemeIds: [scheme.id],
    };
  }

  if (intent === "deadline") {
    return {
      text: `${scheme.name}: ${scheme.applicationDeadline}\n\n${t("Deadlines can change; confirm the latest date with the official department.")}`,
      schemeIds: [scheme.id],
    };
  }

  if (intent === "contact") {
    return {
      text: `${scheme.name}: ${scheme.contact}`,
      schemeIds: [scheme.id],
    };
  }

  if (intent === "application") {
    return {
      text: `${scheme.name}\n${t("Apply online")}: ${scheme.applicationGuidance.online}\n\n${t("Apply offline / in person")}: ${scheme.applicationGuidance.offline}\n\n${t("After you submit")}: ${scheme.applicationGuidance.afterSubmission}`,
      schemeIds: [scheme.id],
    };
  }

  if (intent === "eligibility") {
    const occupation = getProfileOccupation(scheme.id);
    const result = evaluateSchemeEligibility(scheme.id, occupation ? { occupation } : {});
    const reasons = result.relevanceReasons.map((reason) => t(reason)).join("\n");
    return {
      text: `${scheme.simpleExplanation}\n\n${scheme.eligibilityCriteria}\n\n${reasons}\n\n${t("I can't confirm eligibility from a chat message. The scheme authority checks the current rules and your full application.")}`,
      schemeIds: [scheme.id],
    };
  }

  if (intent === "benefits") {
    return {
      text: `${scheme.simpleExplanation}\n\n${t("Benefits provided")}: ${scheme.benefits}\n\n${t("I can't confirm eligibility from a chat message. The scheme authority checks the current rules and your full application.")}`,
      schemeIds: [scheme.id],
    };
  }

  if (topicSchemeId && !mentionedSchemeId) {
    const occupation = getProfileOccupation(scheme.id);
    const result = evaluateSchemeEligibility(scheme.id, occupation ? { occupation } : {});
    const reasons = result.relevanceReasons.map((reason) => t(reason)).join("\n");
    return {
      text: `${t("Your details point to a scheme worth checking, but they do not prove eligibility.")}\n\n${scheme.simpleExplanation}\n\n${reasons}\n\n${t("I can't confirm eligibility from a chat message. The scheme authority checks the current rules and your full application.")}`,
      schemeIds: [scheme.id],
    };
  }

  return {
    text: `${scheme.simpleExplanation}\n\n${t("Benefits provided")}: ${scheme.benefits}\n\n${t("Name a scheme or ask about its benefits, documents, deadline, contact, or application process.")}`,
    schemeIds: [scheme.id],
  };
}
