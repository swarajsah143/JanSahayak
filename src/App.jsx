import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { evaluateSchemeEligibility, getEligibilityStatusLabel } from "./eligibility.js";
import { answerSchemeQuestion } from "./chatbot.js";
import AdminDashboard from "./AdminDashboard.jsx";
import { readAdminSchemeCatalog, writeAdminSchemeCatalog } from "./admin-catalog.js";
import { readSavedSchemes, writeSavedSchemes } from "./saved-schemes.js";
import { categories, schemes as defaultSchemes } from "./data/schemes.js";
import { localizeScheme, translate } from "./localization.js";
import HeroIllustration from "./HeroIllustration.jsx";
import {
  searchNearbyServiceCentres,
  ServiceCentreSearchError,
} from "./service-centres.js";
import {
  acknowledgeSchemeCatalogChanges,
  getSmartNotifications,
  readSchemeCatalogChanges,
} from "./notifications.js";
import { clampChatPosition, getChatPanelLayout } from "./chat-position.js";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  FileText,
  Heart,
  Home,
  Landmark,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Menu,
  Move,
  Navigation,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  UserRound,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

const initialProfile = { state: "", age: "", householdIncome: "", occupation: "" };
const initialPersonalProfile = {
  fullName: "",
  dateOfBirth: "",
  gender: "",
  state: "",
  district: "",
  annualIncome: "",
  occupation: "",
  socialCategory: "",
  familySize: "",
  familyDetails: "",
  disabilityStatus: "",
  disabilityDetails: "",
};

function getServiceCentreDirectionsUrl(centre) {
  const directions = new URL("https://www.openstreetmap.org/directions");
  directions.searchParams.set("engine", "fossgis_osrm_car");
  directions.searchParams.set("route", `;${centre.latitude},${centre.longitude}`);
  return directions.toString();
}

function getSafeWebsiteUrl(website) {
  if (typeof website !== "string") return "";
  const value = website.trim();
  if (!value) return "";
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch (error) {
    if (error instanceof TypeError) return "";
    throw error;
  }
}

function getServiceCentrePhoneUrl(phone) {
  if (typeof phone !== "string") return "";
  const number = phone.replace(/[^\d+]/g, "");
  return /\d{5,}/.test(number) ? `tel:${number}` : "";
}

function getServiceCentreEmailUrl(email) {
  if (typeof email !== "string") return "";
  return /^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(email) ? `mailto:${email}` : "";
}

function App() {
  const shouldReduceMotion = useReducedMotion();
  const [profile, setProfile] = useState(initialProfile);
  const [personalProfile, setPersonalProfile] = useState(initialPersonalProfile);
  const [category, setCategory] = useState("All schemes");
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("en");
  const [hasChecked, setHasChecked] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [saved, setSaved] = useState(() => {
    try {
      return typeof window === "undefined" ? [] : readSavedSchemes(window.localStorage);
    } catch (error) {
      console.error("Could not read saved schemes.", error);
      return [];
    }
  });
  const [showInfo, setShowInfo] = useState(false);
  const [selectedSchemeId, setSelectedSchemeId] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPosition, setChatPosition] = useState(null);
  const [chatDragging, setChatDragging] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const chatMessagesEndRef = useRef(null);
  const chatLauncherRef = useRef(null);
  const chatDragRef = useRef({ pointerId: null, moved: false });
  const [serviceArea, setServiceArea] = useState("");
  const [serviceCentreConsent, setServiceCentreConsent] = useState(false);
  const [serviceCentres, setServiceCentres] = useState([]);
  const [serviceCentreLocation, setServiceCentreLocation] = useState("");
  const [serviceCentreStatus, setServiceCentreStatus] = useState("idle");
  const [serviceCentreError, setServiceCentreError] = useState("");
  const [collectedDocuments, setCollectedDocuments] = useState({});
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [narrationStatus, setNarrationStatus] = useState("");
  const [screen, setScreen] = useState("dashboard");
  const [schemeCatalogState, setSchemeCatalogState] = useState(() => {
    try {
      return {
        catalog: typeof window === "undefined"
          ? defaultSchemes
          : readAdminSchemeCatalog(defaultSchemes, window.localStorage),
        error: false,
      };
    } catch (error) {
      console.error("Could not read the saved admin scheme catalog.", error);
      return { catalog: defaultSchemes, error: true };
    }
  });
  const schemeCatalog = schemeCatalogState.catalog;
  const [authMode, setAuthMode] = useState("register");
  const [account, setAccount] = useState(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [startedChecklistIds, setStartedChecklistIds] = useState([]);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window === "undefined" ? 0 : window.innerWidth,
    height: typeof window === "undefined" ? 0 : window.innerHeight,
  }));
  const [catalogTracking, setCatalogTracking] = useState(() => {
    try {
      return {
        changes: typeof window === "undefined" ? [] : readSchemeCatalogChanges(schemeCatalog, window.localStorage),
        error: false,
      };
    } catch (error) {
      console.error("Could not read the scheme catalog notification snapshot.", error);
      return { changes: [], error: true };
    }
  });
  const t = (text) => translate(text, language);
  const selectedSchemeRecord = schemeCatalog.find((scheme) => scheme.id === selectedSchemeId);
  const selectedScheme = localizeScheme(selectedSchemeRecord, language);
  const kannadaSelectedScheme = localizeScheme(selectedSchemeRecord, "kn");
  const SelectedSchemeIcon = selectedSchemeRecord?.icon;
  const selectedSchemeDocuments = selectedScheme?.requiredDocuments ?? [];
  const selectedSchemeCollected = selectedScheme
    ? collectedDocuments[selectedScheme.id] ?? {}
    : {};
  const collectedDocumentCount = Object.values(selectedSchemeCollected).filter(Boolean).length;
  const checklistProgress = selectedSchemeDocuments.length
    ? Math.round((collectedDocumentCount / selectedSchemeDocuments.length) * 100)
    : 0;

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const updateViewportSize = () => {
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      setViewportSize(viewport);
      setChatPosition((current) => {
        if (!current) return current;
        const launcher = chatLauncherRef.current?.getBoundingClientRect();
        return clampChatPosition(
          current.left,
          current.top,
          launcher?.width ?? current.width,
          launcher?.height ?? current.height,
          viewport,
        );
      });
    };

    window.addEventListener("resize", updateViewportSize);
    return () => window.removeEventListener("resize", updateViewportSize);
  }, []);

  useEffect(() => {
    if (chatOpen) {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [chatMessages, chatOpen]);

  const checkerProfile = {
    ...personalProfile,
    ...profile,
    state: profile.state || personalProfile.state,
    age: profile.age,
    householdIncome: profile.householdIncome || personalProfile.annualIncome,
    occupation: profile.occupation || personalProfile.occupation,
  };
  const screeningResults = useMemo(
    () =>
      Object.fromEntries(
        schemeCatalog.map((scheme) => [
          scheme.id,
          evaluateSchemeEligibility(scheme.id, checkerProfile),
        ]),
      ),
    [schemeCatalog, checkerProfile.age, checkerProfile.disabilityStatus, checkerProfile.familySize,
      checkerProfile.householdIncome, checkerProfile.occupation, checkerProfile.socialCategory],
  );
  const verifiedEligibleCount = Object.values(screeningResults).filter(
    (result) => result.status === "eligible",
  ).length;
  const verifiedNotEligibleCount = Object.values(screeningResults).filter(
    (result) => result.status === "not-eligible",
  ).length;
  const needsVerificationCount = Object.values(screeningResults).filter(
    (result) => result.status !== "eligible" && result.status !== "not-eligible",
  ).length;
  const profileMatchSchemes = useMemo(
    () => schemeCatalog
      .filter((scheme) => screeningResults[scheme.id]?.relevanceScore > 0)
      .sort((first, second) =>
        screeningResults[second.id].relevanceScore - screeningResults[first.id].relevanceScore,
      ),
    [schemeCatalog, screeningResults],
  );
  const relevantNotificationSchemeIds = useMemo(() => [
    ...new Set([
      ...saved,
      ...startedChecklistIds,
      ...(hasChecked
        ? schemeCatalog
            .filter((scheme) => screeningResults[scheme.id]?.relevanceScore > 0)
            .map((scheme) => scheme.id)
        : []),
    ]),
  ], [hasChecked, saved, schemeCatalog, screeningResults, startedChecklistIds]);
  const smartNotifications = useMemo(
    () => getSmartNotifications({
      schemes: schemeCatalog,
      collectedDocuments,
      startedChecklistIds,
      relevantSchemeIds: relevantNotificationSchemeIds,
      catalogChanges: catalogTracking.changes,
    }),
    [catalogTracking.changes, collectedDocuments, relevantNotificationSchemeIds, schemeCatalog, startedChecklistIds],
  );
  const chatWidgetStyle = chatPosition
    ? {
        left: `${chatPosition.left}px`,
        top: `${chatPosition.top}px`,
        right: "auto",
        bottom: "auto",
      }
    : undefined;
  const chatPanelLayout = chatPosition && viewportSize.width > 0
    ? getChatPanelLayout(chatPosition, {
        ...viewportSize,
        isMobile: viewportSize.width <= 520,
      })
    : null;
  const chatPanelStyle = chatPanelLayout
    ? {
        position: "fixed",
        left: `${chatPanelLayout.left}px`,
        right: "auto",
        width: `${chatPanelLayout.width}px`,
        height: `${chatPanelLayout.height}px`,
        minHeight: `${chatPanelLayout.minHeight}px`,
        ...(chatPanelLayout.side === "above"
          ? { top: "auto", bottom: `${chatPanelLayout.bottom}px` }
          : { top: `${chatPanelLayout.top}px`, bottom: "auto" }),
      }
    : undefined;

  const visibleSchemes = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = schemeCatalog.filter((scheme) => {
      const localizedScheme = localizeScheme(scheme, language);
      const matchesCategory = category === "All schemes" || scheme.category === category;
      const matchesSearch =
        !query ||
        `${scheme.name} ${scheme.category} ${scheme.department} ${scheme.description} ${scheme.benefits} ${localizedScheme.name} ${localizedScheme.category} ${localizedScheme.department} ${localizedScheme.description} ${localizedScheme.benefits}`.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
    if (!hasChecked) return matches;

    return matches
      .map((scheme) => ({ ...scheme, eligibility: screeningResults[scheme.id] }))
      .sort((first, second) => second.eligibility.relevanceScore - first.eligibility.relevanceScore);
  }, [category, hasChecked, language, schemeCatalog, screeningResults, search]);

  const updateProfile = (event) => {
    setProfile({ ...profile, [event.target.name]: event.target.value });
  };

  const checkEligibility = (event) => {
    event.preventDefault();
    setHasChecked(true);
    document.getElementById("schemes")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const stopNarration = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setNarrationStatus("");
  };

  const saveAdminCatalog = (nextCatalog) => {
    try {
      writeAdminSchemeCatalog(nextCatalog, window.localStorage);
      setSchemeCatalogState({ catalog: nextCatalog, error: false });
      setCatalogTracking((current) => {
        try {
          return {
            changes: readSchemeCatalogChanges(nextCatalog, window.localStorage),
            error: current.error,
          };
        } catch (error) {
          console.error("Could not refresh scheme catalog notifications after an admin edit.", error);
          return { ...current, error: true };
        }
      });
      return true;
    } catch (error) {
      console.error("Could not save the admin scheme catalog.", error);
      setSchemeCatalogState((current) => ({ ...current, error: true }));
      return false;
    }
  };

  const readKannadaNarration = () => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      typeof window.SpeechSynthesisUtterance !== "function"
    ) {
      setNarrationStatus(t("Text-to-speech is not available in this browser."));
      return;
    }

    const narrationText = [
      kannadaSelectedScheme.name,
      "ಸರಳವಾಗಿ ಹೇಳುವುದಾದರೆ",
      kannadaSelectedScheme.simpleExplanation,
      "ಯಾರು ಅರ್ಜಿ ಸಲ್ಲಿಸಬಹುದು",
      kannadaSelectedScheme.audience,
      "ಪ್ರಯೋಜನಗಳು",
      kannadaSelectedScheme.benefits,
      "ಅರ್ಜಿ ಸಲ್ಲಿಸುವ ಹಂತಗಳು",
      ...kannadaSelectedScheme.applicationSteps,
    ].join(". ");
    const utterance = new window.SpeechSynthesisUtterance(narrationText);
    utterance.lang = "kn-IN";
    const kannadaVoice = window.speechSynthesis
      .getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith("kn"));
    if (kannadaVoice) utterance.voice = kannadaVoice;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (event) => {
      setIsSpeaking(false);
      if (event.error !== "canceled") {
        setNarrationStatus(t("Kannada narration could not be started."));
      }
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
    setNarrationStatus("");
  };

  const toggleSaved = (id) => {
    const nextSaved = saved.includes(id)
      ? saved.filter((savedId) => savedId !== id)
      : [...saved, id];
    setSaved(nextSaved);
    try {
      writeSavedSchemes(nextSaved, window.localStorage);
    } catch (error) {
      console.error("Could not persist saved schemes.", error);
    }
  };

  const openSchemeDetails = (id) => {
    setStartedChecklistIds((current) =>
      current.includes(id) ? current : [...current, id],
    );
    setSelectedSchemeId(id);
    setNotificationPanelOpen(false);
  };

  const acknowledgeCatalogUpdates = () => {
    try {
      acknowledgeSchemeCatalogChanges(schemeCatalog, window.localStorage);
      setCatalogTracking({ changes: [], error: false });
    } catch (error) {
      console.error("Could not acknowledge scheme catalog changes.", error);
      setCatalogTracking((current) => ({ ...current, error: true }));
    }
  };

  const getNotificationCopy = (notification) => {
    const scheme = localizeScheme(
      schemeCatalog.find((item) => item.id === notification.schemeId),
      language,
    );
    const titleKeys = {
      deadline: "Upcoming application deadline",
      checklist: "Incomplete document checklist",
      "new-scheme": "New scheme matching your profile",
      "scheme-updated": "Scheme information changed",
    };
    const messageKeys = {
      deadline: "An application deadline for {scheme} is coming up on {date}. Confirm the date with the official department.",
      checklist: "Your document checklist for {scheme} is incomplete: {collected} of {total} marked collected.",
      "new-scheme": "A new scheme, {scheme}, may match your profile signals. Check its official criteria.",
      "scheme-updated": "Information for {scheme} changed in this app's scheme catalog. Verify details with the official department.",
    };
    const replacements = {
      scheme: scheme?.name ?? "",
      date: notification.deadlineDate
        ? new Date(`${notification.deadlineDate}T12:00:00`).toLocaleDateString(
            language === "en" ? "en-IN" : `${language}-IN`,
            { day: "numeric", month: "short", year: "numeric" },
          )
        : "",
      collected: String(notification.collectedCount ?? ""),
      total: String(notification.totalDocuments ?? ""),
    };
    const message = Object.entries(replacements).reduce(
      (copy, [key, value]) => copy.replaceAll(`{${key}}`, value),
      t(messageKeys[notification.type]),
    );
    return { title: t(titleKeys[notification.type]), message, schemeName: scheme?.name ?? "" };
  };

  const toggleCollectedDocument = (schemeId, documentId) => {
    setCollectedDocuments((current) => ({
      ...current,
      [schemeId]: {
        ...current[schemeId],
        [documentId]: !current[schemeId]?.[documentId],
      },
    }));
  };

  const sendChatQuestion = (question) => {
    const cleanQuestion = question.trim();
    if (!cleanQuestion) return;

    const answer = answerSchemeQuestion(cleanQuestion, language, selectedSchemeId, schemeCatalog);
    setChatMessages((current) => [
      ...current,
      { id: `user-${current.length}`, role: "user", text: cleanQuestion },
      {
        id: `assistant-${current.length + 1}`,
        role: "assistant",
        text: answer.text,
        schemeIds: answer.schemeIds,
      },
    ]);
    setChatInput("");
  };

  const submitChatQuestion = (event) => {
    event.preventDefault();
    sendChatQuestion(chatInput);
  };

  const handleChatPointerDown = (event) => {
    if (event.button !== 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    chatDragRef.current = {
      pointerId: event.pointerId,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleChatPointerMove = (event) => {
    const drag = chatDragRef.current;
    if (drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < 5) return;

    drag.moved = true;
    setChatDragging(true);
    setChatPosition(
      clampChatPosition(
        drag.left + deltaX,
        drag.top + deltaY,
        drag.width,
        drag.height,
        viewportSize,
      ),
    );
  };

  const handleChatPointerUp = (event) => {
    if (chatDragRef.current.pointerId !== event.pointerId) return;
    chatDragRef.current.pointerId = null;
    setChatDragging(false);
  };

  const handleChatPointerCancel = () => {
    chatDragRef.current.pointerId = null;
    chatDragRef.current.moved = false;
    setChatDragging(false);
  };

  const handleChatLauncherClick = (event) => {
    if (chatDragRef.current.moved) {
      chatDragRef.current.moved = false;
      event.preventDefault();
      return;
    }
    setChatOpen((open) => !open);
  };

  const moveChatWithKeyboard = (event) => {
    const movement = {
      ArrowLeft: [-24, 0],
      ArrowRight: [24, 0],
      ArrowUp: [0, -24],
      ArrowDown: [0, 24],
    }[event.key];
    if (!event.altKey || !movement) return;

    event.preventDefault();
    const bounds = chatLauncherRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setChatPosition(
      clampChatPosition(
        bounds.left + movement[0],
        bounds.top + movement[1],
        bounds.width,
        bounds.height,
        viewportSize,
      ),
    );
  };

  const submitServiceCentreSearch = async (event) => {
    event.preventDefault();
    const area = serviceArea.trim();
    if (!area) {
      setServiceCentreStatus("error");
      setServiceCentreError("Enter a city, district, or PIN code to search.");
      return;
    }

    setServiceCentreStatus("loading");
    setServiceCentreError("");
    setServiceCentres([]);
    setServiceCentreLocation("");
    try {
      const result = await searchNearbyServiceCentres(area);
      setServiceCentres(result.centres);
      setServiceCentreLocation(result.locationName);
      setServiceCentreStatus("success");
    } catch (error) {
      const errorKey = error instanceof ServiceCentreSearchError
        ? {
            "empty-query": "Enter a city, district, or PIN code to search.",
            "geocoding-error": "Could not look up that area right now. Check your connection or try again later.",
            "location-not-found": "Could not find that area in India. Try a nearby city, district, or PIN code.",
            "directory-error": "Could not retrieve nearby map listings right now. Try again later or use the official CSC locator.",
            "network-error": "Network access is needed to search nearby centres.",
          }[error.code] ?? "Nearby centre search failed. Try again later."
        : "Nearby centre search failed. Try again later.";
      setServiceCentreError(errorKey);
      setServiceCentreStatus("error");
    }
  };

  const handleAuthSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email")).trim();
    const enteredName = String(formData.get("fullName") || "").trim();
    setAccount({
      email,
      fullName: enteredName || email.split("@")[0],
    });
    if (enteredName) {
      setPersonalProfile((current) => ({ ...current, fullName: enteredName }));
    }
    event.currentTarget.reset();
    setScreen("profile");
  };

  const updatePersonalProfile = (event) => {
    const { name, value } = event.target;
    setPersonalProfile((current) => ({
      ...current,
      [name]: value,
      ...(name === "disabilityStatus" && value !== "Yes" ? { disabilityDetails: "" } : {}),
    }));
    setProfileSaved(false);
  };

  const savePersonalProfile = (event) => {
    event.preventDefault();
    const birthDate = personalProfile.dateOfBirth
      ? new Date(`${personalProfile.dateOfBirth}T00:00:00`)
      : null;
    let age = "";
    if (birthDate && !Number.isNaN(birthDate.getTime())) {
      const today = new Date();
      const years = today.getFullYear() - birthDate.getFullYear() -
        (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate()) ? 1 : 0);
      age = years < 18 ? "Under 18" : years < 30 ? "18–29" : years < 60 ? "30–59" : "60 or above";
    }
    setProfile({
      state: personalProfile.state,
      age,
      householdIncome: personalProfile.annualIncome,
      occupation: personalProfile.occupation,
    });
    setAccount((current) => current && ({
      ...current,
      fullName: personalProfile.fullName.trim() || current.fullName,
    }));
    setProfileSaved(true);
    setHasChecked(false);
  };

  const signOut = () => {
    setAccount(null);
    setPersonalProfile(initialPersonalProfile);
    setProfile(initialProfile);
    setHasChecked(false);
    setProfileSaved(false);
    setCollectedDocuments({});
    setStartedChecklistIds([]);
    setScreen("dashboard");
  };

  if (screen === "admin") {
    return (
      <AdminDashboard
        catalog={schemeCatalog}
        onCatalogSave={saveAdminCatalog}
        onBack={() => setScreen("dashboard")}
        storageError={schemeCatalogState.error}
      />
    );
  }

  if (screen !== "dashboard") {
    return (
      <div className="account-page" lang={language}>
        <div className="account-orb account-orb-one" />
        <div className="account-orb account-orb-two" />
        <header className="account-header">
          <a className="account-brand" href="#home" onClick={(event) => { event.preventDefault(); setScreen("dashboard"); }}>
            <span className="brand-mark"><Landmark size={21} /></span>
            <span>jan<span className="brand-light">sahayak</span></span>
          </a>
          <div className="account-header-actions">
            <label className="language-select account-language-select">
              <span className="sr-only">{t("Choose language")}</span>
              <select value={language} onChange={(event) => { stopNarration(); setLanguage(event.target.value); }}>
                <option value="en">English</option>
                <option value="kn">ಕನ್ನಡ (Kannada)</option>
                <option value="hi">हिन्दी (Hindi)</option>
              </select>
              <ChevronDown size={14} />
            </label>
            <span className="prototype-label"><span /> {t("Prototype mode · personal data not saved")}</span>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {screen === "auth" ? (
            <motion.section
              className="account-card"
              key="auth"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <button className="account-back" onClick={() => setScreen("dashboard")}>← {t("Back to overview")}</button>
              <div className="account-icon"><UserRound size={21} /></div>
              <div className="section-kicker">{t("YOUR JAN SAHAYAK SPACE")}</div>
              <h1 className="account-title">{authMode === "register" ? t("Create your account") : t("Welcome back")}</h1>
              <p className="account-copy">
                {authMode === "register"
                  ? t("Set up a profile so your scheme search can be more personal.")
                  : t("Sign in to continue to your profile and scheme discovery.")}
              </p>
              <form className="account-form" onSubmit={handleAuthSubmit}>
                {authMode === "register" && (
                  <label className="field">
                    <span>{t("Full name")}</span>
                    <input name="fullName" type="text" autoComplete="name" placeholder={t("Enter your name")} required />
                  </label>
                )}
                <label className="field">
                  <span>{t("Email address")}</span>
                  <input name="email" type="email" autoComplete="email" placeholder={t("you@example.com")} required />
                </label>
                <label className="field">
                  <span>{t("Demo password")} <small>{t("(do not reuse a real password)")}</small></span>
                  <input name="password" type="password" autoComplete={authMode === "register" ? "new-password" : "current-password"} minLength="8" placeholder={t("At least 8 characters")} required />
                </label>
                <button className="primary-button account-submit" type="submit">
                  {authMode === "register" ? t("Create account") : t("Sign in")} <ArrowRight size={16} />
                </button>
              </form>
              <p className="auth-switch">
                {authMode === "register" ? t("Already have an account?") : t("New to Jan Sahayak?")}{" "}
                <button onClick={() => setAuthMode(authMode === "register" ? "login" : "register")}>
                  {authMode === "register" ? t("Sign in") : t("Create account")}
                </button>
              </p>
              <div className="prototype-warning"><ShieldCheck size={16} /> {t("Demo only: this form does not create or verify an account. Do not enter a real password.")}</div>
            </motion.section>
          ) : (
            <motion.section
              className="account-card profile-editor"
              key="profile"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <button className="account-back" onClick={() => setScreen("dashboard")}>← {t("Back to overview")}</button>
              <div className="account-icon"><Users size={21} /></div>
              <div className="section-kicker">{account ? `${t("SIGNED IN AS")} ${account.email}` : t("PROFILE MANAGEMENT")}</div>
              <h1 className="account-title">{personalProfile.fullName ? t("Your profile") : t("Create your profile")}</h1>
              <p className="account-copy">{t("Add or update details to help tailor your scheme discovery. You can leave sensitive fields blank.")}</p>
              <form className="account-form" onSubmit={savePersonalProfile}>
                <div className="profile-form-grid">
                  <label className="field">
                    <span>{t("Full name")}</span>
                    <input name="fullName" type="text" autoComplete="name" value={personalProfile.fullName} onChange={updatePersonalProfile} required />
                  </label>
                  <label className="field">
                    <span>{t("Date of birth")}</span>
                    <input name="dateOfBirth" type="date" autoComplete="bday" value={personalProfile.dateOfBirth} onChange={updatePersonalProfile} max={new Date().toISOString().slice(0, 10)} />
                  </label>
                  <label className="field">
                    <span>{t("Gender")} <small>{t("(optional)")}</small></span>
                    <select name="gender" value={personalProfile.gender} onChange={updatePersonalProfile}>
                      <option value="">{t("Prefer not to say")}</option><option value="Woman">{t("Woman")}</option><option value="Man">{t("Man")}</option><option value="Non-binary">{t("Non-binary")}</option><option value="Self-describe">{t("Self-describe")}</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>{t("State or union territory")}</span>
                    <input name="state" type="text" autoComplete="address-level1" value={personalProfile.state} onChange={updatePersonalProfile} placeholder={t("e.g. Maharashtra")} />
                  </label>
                  <label className="field">
                    <span>{t("District")}</span>
                    <input name="district" type="text" autoComplete="address-level2" value={personalProfile.district} onChange={updatePersonalProfile} placeholder={t("Your district")} />
                  </label>
                  <label className="field">
                    <span>{t("Annual family income")}</span>
                    <select name="annualIncome" value={personalProfile.annualIncome} onChange={updatePersonalProfile}>
                      <option value="">{t("Prefer not to say")}</option><option value="Below ₹1 lakh">{t("Below ₹1 lakh")}</option><option value="₹1–2.5 lakh">{t("₹1–2.5 lakh")}</option><option value="₹2.5–5 lakh">{t("₹2.5–5 lakh")}</option><option value="Above ₹5 lakh">{t("Above ₹5 lakh")}</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>{t("Occupation")}</span>
                    <select name="occupation" value={personalProfile.occupation} onChange={updatePersonalProfile}>
                      <option value="">{t("Choose an option")}</option><option value="Farmer">{t("Farmer")}</option><option value="Student">{t("Student")}</option><option value="Self-employed">{t("Self-employed")}</option><option value="Wage worker">{t("Wage worker")}</option><option value="Looking for work">{t("Looking for work")}</option><option value="Other">{t("Other")}</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>{t("Social category")} <small>{t("(optional)")}</small></span>
                    <select name="socialCategory" value={personalProfile.socialCategory} onChange={updatePersonalProfile}>
                      <option value="">{t("Prefer not to say")}</option><option value="General">{t("General")}</option><option>OBC</option><option>SC</option><option>ST</option><option value="Other">{t("Other")}</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>{t("Household size")}</span>
                    <select name="familySize" value={personalProfile.familySize} onChange={updatePersonalProfile}>
                      <option value="">{t("Choose household size")}</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option value="6 or more">{t("6 or more")}</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>{t("Disability status")} <small>{t("(optional)")}</small></span>
                    <select name="disabilityStatus" value={personalProfile.disabilityStatus} onChange={updatePersonalProfile}>
                      <option value="">{t("Prefer not to say")}</option><option value="No">{t("No")}</option><option value="Yes">{t("Yes")}</option>
                    </select>
                  </label>
                </div>
                {personalProfile.disabilityStatus === "Yes" && (
                  <label className="field">
                    <span>{t("Disability-related note")} <small>{t("(optional; do not include medical documents)")}</small></span>
                    <input name="disabilityDetails" type="text" value={personalProfile.disabilityDetails} onChange={updatePersonalProfile} placeholder={t("Only share what is relevant to your scheme search")} />
                  </label>
                )}
                <label className="field family-details-field">
                  <span>{t("Family details")} <small>{t("(optional)")}</small></span>
                  <textarea name="familyDetails" rows="3" value={personalProfile.familyDetails} onChange={updatePersonalProfile} placeholder={t("Share only details that may help identify relevant support.")} />
                </label>
                <div className="prototype-warning"><ShieldCheck size={16} /> {t("Profile data exists only in this page session and is cleared when you refresh or sign out.")}</div>
                {profileSaved && <p className="save-confirmation" role="status"><Check size={15} /> {t("Profile updated for this session.")}</p>}
                <div className="profile-actions">
                  {account && <button className="text-button" type="button" onClick={signOut}><LogOut size={15} /> {t("Sign out")}</button>}
                  <button className="primary-button" type="submit">{t("Save profile")} <Check size={16} /></button>
                </div>
              </form>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="app-shell" lang={language}>
      <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
        <a className="brand" href="#home" aria-label={t("Jan Sahayak home")}>
          <span className="brand-mark"><Landmark size={21} strokeWidth={2.2} /></span>
          <span>jan<span className="brand-light">sahayak</span></span>
        </a>

        <div className="sidebar-label">{t("YOUR SPACE")}</div>
        <nav className="side-nav" aria-label={t("Main navigation")}>
          <a className="nav-item active" href="#home" onClick={() => setMobileMenuOpen(false)}>
            <Home size={18} /> <span>{t("Overview")}</span>
          </a>
          <a className="nav-item" href="#schemes" onClick={() => setMobileMenuOpen(false)}>
            <Search size={18} /> <span>{t("Find schemes")}</span>
            <span className="nav-count">{String(schemeCatalog.length).padStart(2, "0")}</span>
          </a>
          <a className="nav-item" href="#service-centres" onClick={() => setMobileMenuOpen(false)}>
            <MapPin size={18} /> <span>{t("Nearby centres")}</span>
          </a>
          <button className="nav-item nav-button" onClick={() => { setScreen(account ? "profile" : "auth"); setAuthMode("register"); }}>
            <UserRound size={18} /> <span>{account ? t("My profile") : t("Sign in / Register")}</span>
          </button>
          <button className="nav-item nav-button" onClick={() => { setScreen("admin"); setMobileMenuOpen(false); }}>
            <ShieldCheck size={18} /> <span>Admin panel</span>
            <span className="nav-count">DEMO</span>
          </button>
          <button className="nav-item nav-button" onClick={() => setShowInfo(true)}>
            <FileText size={18} /> <span>{t("How it works")}</span>
          </button>
        </nav>

        <div className="sidebar-spacer" />
        <div className="help-card">
          <div className="help-icon"><Heart size={17} fill="currentColor" /></div>
          <p>{t("Everyone deserves to know what support is out there.")}</p>
          <button onClick={() => setShowInfo(true)}>{t("Learn about us")} <ArrowRight size={14} /></button>
          <span className="help-decoration" aria-hidden="true">✳</span>
        </div>
        <div className="sidebar-foot">
          <ShieldCheck size={15} /> {t("Demo only · personal data not saved")}
        </div>
      </aside>

      <motion.main
        className="main-content"
        id="home"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.5, ease: "easeOut" }}
      >
        <header className="topbar">
          <button
            className="mobile-menu-button"
            aria-label={mobileMenuOpen ? t("Close menu") : t("Open menu")}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="breadcrumb">{t("Your space")} <span>/</span> <b>{t("Overview")}</b></div>
          <div className="topbar-actions">
            <span className="secure-label"><span className="secure-dot" /> {t("Prototype · personal data not saved")}</span>
            <div className="notification-menu">
              <button
                className="notification-toggle"
                type="button"
                aria-label={`${t("Smart notifications")}: ${smartNotifications.length}`}
                aria-expanded={notificationPanelOpen}
                aria-controls="notification-panel"
                onClick={() => setNotificationPanelOpen((open) => !open)}
              >
                <Bell size={17} />
                {smartNotifications.length > 0 && (
                  <span className="notification-badge" aria-hidden="true">
                    {smartNotifications.length > 9 ? "9+" : smartNotifications.length}
                  </span>
                )}
              </button>
              <AnimatePresence>
                {notificationPanelOpen && (
                  <motion.section
                    className="notification-panel"
                    id="notification-panel"
                    role="region"
                    aria-labelledby="notification-panel-title"
                    initial={{ opacity: 0, y: -7 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
                  >
                    <header className="notification-panel-header">
                      <div>
                        <h2 id="notification-panel-title">{t("Smart notifications")}</h2>
                        <p>{t("Reminders appear only while this page is open. No browser push, email, or SMS is sent.")}</p>
                      </div>
                      <button
                        type="button"
                        className="notification-close"
                        aria-label={t("Close notifications")}
                        onClick={() => setNotificationPanelOpen(false)}
                      >
                        <X size={17} />
                      </button>
                    </header>
                    {smartNotifications.length > 0 ? (
                      <div className="notification-list" aria-live="polite">
                        {smartNotifications.map((notification) => {
                          const Icon = notification.type === "deadline"
                            ? CalendarDays
                            : notification.type === "checklist"
                              ? FileText
                              : Sparkles;
                          const copy = getNotificationCopy(notification);
                          return (
                            <button
                              className={`notification-item notification-${notification.type}`}
                              type="button"
                              key={notification.id}
                              aria-label={`${copy.title}: ${copy.schemeName}`}
                              onClick={() => openSchemeDetails(notification.schemeId)}
                            >
                              <span className="notification-icon"><Icon size={16} /></span>
                              <span className="notification-copy">
                                <strong>{copy.title}</strong>
                                <span>{copy.message}</span>
                              </span>
                              <ArrowRight className="notification-arrow" size={15} />
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="notification-empty">
                        <span className="notification-empty-icon"><Bell size={17} /></span>
                        <strong>{t("No reminders right now")}</strong>
                        <p>{t("Start a checklist or run the profile checker to personalize reminders.")}</p>
                      </div>
                    )}
                    {catalogTracking.error && (
                      <p className="notification-error" role="status">
                        {t("Scheme update tracking is unavailable in this browser.")}
                      </p>
                    )}
                    <footer className="notification-panel-footer">
                      <p>{t("Exact date reminders require a date in the catalog; this demo has no verified date-specific deadlines.")}</p>
                      <p>{t("Scheme update alerts compare the demo catalog using a non-personal browser snapshot; they do not track live government changes.")}</p>
                      {smartNotifications.some((notification) =>
                        notification.type === "new-scheme" || notification.type === "scheme-updated"
                      ) && (
                        <button type="button" onClick={acknowledgeCatalogUpdates}>
                          {t("Mark scheme updates as seen")}
                        </button>
                      )}
                    </footer>
                  </motion.section>
                )}
              </AnimatePresence>
            </div>
            <button className="account-menu-button" onClick={() => { setScreen(account ? "profile" : "auth"); setAuthMode("register"); }}>
              {account ? <><UserRound size={15} /> {account.fullName}</> : <><LogIn size={15} /> {t("Sign in")}</>}
            </button>
            <label className="language-select">
              <span className="sr-only">{t("Choose language")}</span>
              <select value={language} onChange={(event) => { stopNarration(); setLanguage(event.target.value); }}>
                <option value="en">English</option>
                <option value="kn">ಕನ್ನಡ (Kannada)</option>
                <option value="hi">हिन्दी (Hindi)</option>
              </select>
              <ChevronDown size={14} />
            </label>
          </div>
        </header>

        <div className="page-wrap">
          <motion.section
            className="welcome-row"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.55, ease: "easeOut" }}
          >
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> {t("A LITTLE HELP, A LOT OF POSSIBILITIES")}</div>
              <h1>{t("Good morning")}<span className="period">.</span><br />{t("Let’s find your ")}<span className="serif-accent">{t("support.")}</span></h1>
              <p className="welcome-copy">
                {t("Government schemes, made easier to find and understand.")}<br className="desktop-break" />
                {t("Start with a few details — we’ll help with the rest.")}
              </p>
            </div>
            <HeroIllustration firstLine={t("a brighter")} secondLine={t("way forward")} />
          </motion.section>

          <section className="stats-row" aria-label={t("About this service")}>
            <div className="stat-item">
              <div className="stat-icon stat-mint"><Landmark size={17} /></div>
              <div><strong>{t("One simpler place")}</strong><span>{t("Explore support from trusted sources")}</span></div>
            </div>
            <div className="stat-item">
              <div className="stat-icon stat-yellow"><Sparkles size={17} /></div>
              <div><strong>{t("Made for you")}</strong><span>{t("Discover schemes that may fit your needs")}</span></div>
            </div>
            <div className="stat-item">
              <div className="stat-icon stat-peach"><ShieldCheck size={17} /></div>
              <div><strong>{t("Your privacy matters")}</strong><span>{t("Your answers aren't saved or shared")}</span></div>
            </div>
          </section>

          <div className="section-heading">
            <div>
              <div className="section-kicker">{t("LET’S GET STARTED")}</div>
              <h2>{t("A few details make all the difference")}</h2>
            </div>
            <span className="step-pill"><span>01</span> / 02</span>
          </div>

          <motion.section
            className="profile-card"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.5, delay: shouldReduceMotion ? 0 : 0.14 }}
          >
            <div className="profile-intro">
              <div className="profile-icon"><Users size={20} /></div>
              <div>
                <h3>{t("Tell us about your household")}</h3>
                <p>{t("This helps us point you in the right direction. All fields are optional.")}</p>
              </div>
              <button
                className="info-button"
                aria-label={t("Why we ask these questions")}
                onClick={() => setShowInfo(true)}
              >
                <CircleHelp size={18} />
              </button>
            </div>
            <form onSubmit={checkEligibility}>
              <div className="form-grid">
                <label className="field">
                  <span>{t("Your state or union territory")}</span>
                  <select name="state" value={profile.state} onChange={updateProfile}>
                    <option value="">{t("Select your state")}</option>
                    <option value="Andhra Pradesh">{t("Andhra Pradesh")}</option><option value="Assam">{t("Assam")}</option><option value="Bihar">{t("Bihar")}</option>
                    <option value="Delhi">{t("Delhi")}</option><option value="Gujarat">{t("Gujarat")}</option><option value="Karnataka">{t("Karnataka")}</option>
                    <option value="Kerala">{t("Kerala")}</option><option value="Maharashtra">{t("Maharashtra")}</option><option value="Rajasthan">{t("Rajasthan")}</option>
                    <option value="Tamil Nadu">{t("Tamil Nadu")}</option><option value="Uttar Pradesh">{t("Uttar Pradesh")}</option><option value="West Bengal">{t("West Bengal")}</option>
                    <option value="Other / prefer not to say">{t("Other / prefer not to say")}</option>
                  </select>
                  <ChevronDown className="field-chevron" size={15} />
                </label>
                <label className="field">
                  <span>{t("Age group")}</span>
                  <select name="age" value={profile.age} onChange={updateProfile}>
                    <option value="">{t("Choose age group")}</option>
                    <option value="Under 18">{t("Under 18")}</option><option value="18–29">{t("18–29")}</option><option value="30–59">{t("30–59")}</option>
                    <option value="60 or above">{t("60 or above")}</option><option value="Prefer not to say">{t("Prefer not to say")}</option>
                  </select>
                  <ChevronDown className="field-chevron" size={15} />
                </label>
                <label className="field">
                  <span>{t("Household income (yearly)")}</span>
                  <select name="householdIncome" value={profile.householdIncome} onChange={updateProfile}>
                    <option value="">{t("Select an approximate range")}</option>
                    <option value="Below ₹1 lakh">{t("Below ₹1 lakh")}</option><option value="₹1–2.5 lakh">{t("₹1–2.5 lakh")}</option><option value="₹2.5–5 lakh">{t("₹2.5–5 lakh")}</option>
                    <option value="Above ₹5 lakh">{t("Above ₹5 lakh")}</option><option value="Prefer not to say">{t("Prefer not to say")}</option>
                  </select>
                  <ChevronDown className="field-chevron" size={15} />
                </label>
                <label className="field">
                  <span>{t("What best describes you?")}</span>
                  <select name="occupation" value={profile.occupation} onChange={updateProfile}>
                    <option value="">{t("Choose an option")}</option>
                    <option value="Farmer">{t("Farmer")}</option><option value="Student">{t("Student")}</option><option value="Self-employed">{t("Self-employed")}</option>
                    <option value="Wage worker">{t("Wage worker")}</option><option value="Looking for work">{t("Looking for work")}</option><option value="Other">{t("Other")}</option>
                  </select>
                  <ChevronDown className="field-chevron" size={15} />
                </label>
              </div>
              <div className="form-footer">
                <span className="privacy-note"><ShieldCheck size={15} /> {t("Your answers stay private and are not stored.")}</span>
                <button className="primary-button" type="submit">
                  {t("Show schemes for me")} <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </motion.section>

          <section className="schemes-section" id="schemes">
            <div className="schemes-heading">
              <div>
                <div className="section-kicker">{t("A GOOD PLACE TO BEGIN")}</div>
                <h2>{hasChecked ? t("Schemes to explore") : t("Popular schemes to explore")} <span className="heading-count">0{visibleSchemes.length}</span></h2>
              </div>
              <a className="text-link" href="#scheme-list">{t("Browse all schemes")} <ArrowRight size={15} /></a>
            </div>
            {hasChecked && (
              <motion.div
                className="screening-results"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
              >
                <div className="screening-summary">
                  <div className="screening-summary-title"><Sparkles size={16} /> {t("Preliminary screening results")}</div>
                  <div className="screening-counts">
                    <span><b>{verifiedEligibleCount}</b> {t("eligible (verified)")}</span>
                    <span><b>{needsVerificationCount}</b> {t("need verification")}</span>
                    <span><b>{verifiedNotEligibleCount}</b> {t("not eligible (verified)")}</span>
                  </div>
                </div>
                <p>{t("This prototype uses profile signals to prioritize schemes; it is not connected to official eligibility rules. Missing or unmatched details are never treated as proof that you qualify or do not qualify.")}</p>
                {profileMatchSchemes.length > 0 && (
                  <div className="profile-match-grid" aria-label={t("Profile match explanations")}>
                    {profileMatchSchemes.map((scheme) => {
                      const displayScheme = localizeScheme(scheme, language);
                      const match = screeningResults[scheme.id];
                      return (
                        <article className="profile-match-card" key={scheme.id}>
                          <div className="profile-match-heading">
                            <span>{t("Recommended scheme")}</span>
                            <span className="profile-match-badge">{t("Potential match")}</span>
                          </div>
                          <h3>{displayScheme.name}</h3>
                          <h4><Sparkles size={14} /> {t("Why this scheme may match your profile")}</h4>
                          <ul>
                            {match.relevanceReasons.map((reason) => <li key={reason}>{t(reason)}</li>)}
                          </ul>
                          <p className="profile-match-disclaimer">
                            {t("This is a preliminary profile match, not a confirmed eligibility decision. Confirm scheme-specific conditions with the official department.")}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
            <div className="scheme-toolbar">
              <div className="category-tabs" role="group" aria-label={t("Filter schemes by category")}>
                {categories.map((item) => (
                  <button
                    key={item}
                    className={`category-tab ${category === item ? "selected" : ""}`}
                    onClick={() => setCategory(item)}
                  >{t(item)}</button>
                ))}
              </div>
              <label className="search-field">
                <Search size={16} />
                <span className="sr-only">{t("Search schemes")}</span>
                <input
                  type="search"
                  placeholder={t("Search schemes")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            </div>
            <div className="scheme-grid" id="scheme-list">
              <AnimatePresence mode="popLayout">
                {visibleSchemes.map((scheme, index) => {
                  const displayScheme = localizeScheme(scheme, language);
                  const Icon = displayScheme.icon;
                  const isSaved = saved.includes(scheme.id);
                  return (
                    <motion.article
                      className="scheme-card"
                      key={scheme.id}
                      layout={!shouldReduceMotion}
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.45, delay: shouldReduceMotion ? 0 : index * 0.08, ease: "easeOut" }}
                    >
                      <button
                        type="button"
                        className="scheme-card-hit-area"
                        onClick={() => openSchemeDetails(scheme.id)}
                        aria-label={`${t("View details for")} ${displayScheme.name}`}
                      />
                      <div className="scheme-card-top">
                        <div className={`scheme-icon ${scheme.tone}`}><Icon size={25} /></div>
                        <button
                          type="button"
                          className={`save-button ${isSaved ? "is-saved" : ""}`}
                          aria-pressed={isSaved}
                          aria-label={isSaved
                            ? `${t("Remove from saved schemes")} ${displayScheme.name}`
                            : `${t("Save scheme")} ${displayScheme.name}`}
                          onClick={() => toggleSaved(scheme.id)}
                        >
                          <Heart size={16} fill={isSaved ? "currentColor" : "none"} />
                        </button>
                      </div>
                      <div className="scheme-card-meta">
                        <span className="scheme-category">{displayScheme.category}</span>
                        {hasChecked && (
                          <span className={`eligibility-status status-${scheme.eligibility.status}`}>
                            {t(getEligibilityStatusLabel(scheme.eligibility.status))}
                          </span>
                        )}
                      </div>
                      <h3>{displayScheme.name}</h3>
                      <p className="scheme-department">{displayScheme.department}</p>
                      <p className="scheme-description">{displayScheme.description}</p>
                      <div className="scheme-deadline"><CalendarDays size={12} /> {displayScheme.deadlineLabel}</div>
                      <details className="scheme-info">
                        <summary>
                          <span>{hasChecked ? t("Why / next steps") : t("Scheme details")}</span>
                          {hasChecked && (
                            <b>
                              {t(scheme.eligibility.relevanceScore >= 4 ? "Higher" : scheme.eligibility.relevanceScore > 0 ? "Some signals" : "General")}
                            </b>
                          )}
                        </summary>
                        <div className="scheme-card-info">
                          <div><span>{t("GOVERNMENT DEPARTMENT")}</span><p>{displayScheme.department}</p></div>
                          <div><span>{t("BENEFITS")}</span><p>{displayScheme.benefits}</p></div>
                          <div><span>{t("WHO CAN APPLY")}</span><p>{displayScheme.audience}</p></div>
                          <div><span>{t("ELIGIBILITY CRITERIA")}</span><p>{displayScheme.eligibilityCriteria}</p></div>
                          <div><span>{t("APPLICATION DEADLINE")}</span><p>{displayScheme.applicationDeadline}</p></div>
                          <div>
                            <span>{t("REQUIRED DOCUMENTS (INDICATIVE)")}</span>
                            <ul>{displayScheme.requiredDocuments.map((document) => <li key={document.id}>{document.name} — {document.requirementLabel}</li>)}</ul>
                          </div>
                        </div>
                        {hasChecked && (
                          <div className="eligibility-details">
                            <ul className="screening-reasons">
                              {scheme.eligibility.relevanceReasons.map((reason) => <li key={reason}>{t(reason)}</li>)}
                            </ul>
                            <div className="verification-checks">
                              <span>{t("WHAT TO VERIFY")}</span>
                              <ul>{scheme.eligibility.checks.map((check) => <li key={check}>{t(check)}</li>)}</ul>
                            </div>
                          </div>
                        )}
                      </details>
                      <a className="scheme-link" href={scheme.href} target="_blank" rel="noreferrer">
                        {displayScheme.action} <ArrowUpRight size={15} />
                      </a>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
              {visibleSchemes.length === 0 && (
                <div className="empty-state">
                  <Search size={22} />
                  <strong>{t("No schemes found")}</strong>
                  <span>{t("Try another search or choose a different category.")}</span>
                </div>
              )}
            </div>
            <div className="official-note">
              <ShieldCheck size={16} />
              <p>{t("Scheme information can change. This assistant is a starting point, not an official eligibility decision. Always verify details with the relevant government department.")}</p>
              <ArrowDown size={15} />
            </div>
          </section>

          <section className="service-centres-section" id="service-centres" aria-labelledby="service-centres-title">
            <div className="service-centres-heading">
              <div>
                <div className="section-kicker">{t("LOCAL SUPPORT, CLOSER BY")}</div>
                <h2 id="service-centres-title">{t("Nearby government service centres")}</h2>
                <p>{t("Look for Common Service Centres and nearby government offices using mapped OpenStreetMap listings.")}</p>
              </div>
              <div className="service-centres-mark" aria-hidden="true"><MapPin size={20} /></div>
            </div>

            <form className="service-centres-search" onSubmit={submitServiceCentreSearch}>
              <label className="service-centre-area-field">
                <span>{t("City, district, or PIN code in India")}</span>
                <div className="service-centre-input-wrap">
                  <MapPin size={17} />
                  <input
                    type="search"
                    value={serviceArea}
                    onChange={(event) => setServiceArea(event.target.value)}
                    placeholder={t("e.g. Bengaluru or 560001")}
                    maxLength={100}
                    autoComplete="off"
                    required
                  />
                </div>
              </label>
              <label className="service-centre-consent">
                <input
                  type="checkbox"
                  checked={serviceCentreConsent}
                  onChange={(event) => setServiceCentreConsent(event.target.checked)}
                  required
                />
                <span>{t("I understand this area will be sent to Photon and OpenStreetMap for this search.")}</span>
              </label>
              <div className="service-centres-form-footer">
                <p><ShieldCheck size={15} /> {t("Enter only a town, district, or PIN code, not a home or street address. Results use an approximate point for that area; this app does not save the search.")}</p>
                <button className="primary-button" type="submit" disabled={serviceCentreStatus === "loading" || !serviceCentreConsent}>
                  {serviceCentreStatus === "loading" ? t("Searching nearby") : t("Find nearby centres")}
                  {serviceCentreStatus === "loading" ? <span className="service-centre-spinner" aria-hidden="true" /> : <Search size={16} />}
                </button>
              </div>
            </form>

            <div className="service-centres-source-note">
              <span>{t("Map listings and contact details may be incomplete or out of date. Confirm before travelling.")}</span>
              <a href="https://locator.csccloud.in/" target="_blank" rel="noreferrer">
                {t("Open official CSC locator")} <ExternalLink size={13} />
              </a>
            </div>

            {serviceCentreStatus === "loading" && (
              <p className="service-centre-status" role="status">{t("Searching nearby mapped locations…")}</p>
            )}
            {serviceCentreStatus === "error" && (
              <div className="service-centre-error" role="alert">
                <p>{t(serviceCentreError)}</p>
                <div className="service-centre-fallback-links">
                  <a href="https://locator.csccloud.in/" target="_blank" rel="noreferrer">
                    {t("Try the official CSC locator")} <ExternalLink size={13} />
                  </a>
                  <a
                    href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(`${serviceArea} CSC government office`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("Search OpenStreetMap directly")} <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            )}
            {serviceCentreStatus === "success" && (
              <div className="service-centre-results" aria-live="polite">
                <div className="service-centres-results-heading">
                  <div>
                    <span>{t("NEAR")} {serviceCentreLocation}</span>
                    <h3>{serviceCentres.length} {t("mapped centres and offices found")}</h3>
                  </div>
                  <span>{t("Within about 8 km of the search point")}</span>
                </div>
                {serviceCentres.length > 0 ? (
                  <div className="service-centre-grid">
                    {serviceCentres.map((centre) => {
                      const phoneUrl = getServiceCentrePhoneUrl(centre.phone);
                      const emailUrl = getServiceCentreEmailUrl(centre.email);
                      const websiteUrl = getSafeWebsiteUrl(centre.website);
                      const distance = (centre.distanceMeters / 1000).toFixed(1);
                      return (
                        <article className="service-centre-card" key={centre.id}>
                          <div className="service-centre-card-meta">
                            <span className={`service-centre-type ${centre.type}`}>
                              {centre.type === "csc" ? t("Common Service Centre") : t("Government office")}
                            </span>
                            <span>{t("{distance} km away").replace("{distance}", distance)}</span>
                          </div>
                          <h4>{centre.name}</h4>
                          {centre.address && <p className="service-centre-address"><MapPin size={13} /> {centre.address}</p>}
                          <div className="service-centre-contacts">
                            {centre.phone && (
                              <p><Phone size={13} /> {phoneUrl ? <a href={phoneUrl}>{centre.phone}</a> : centre.phone}</p>
                            )}
                            {centre.email && (
                              <p><Mail size={13} /> {emailUrl ? <a href={emailUrl}>{centre.email}</a> : centre.email}</p>
                            )}
                            {centre.website && (
                              <p><ExternalLink size={13} /> {websiteUrl
                                ? <a href={websiteUrl} target="_blank" rel="noreferrer">{centre.website}</a>
                                : centre.website}</p>
                            )}
                            {!centre.phone && !centre.email && !centre.website && (
                              <p className="service-centre-no-contact">{t("No contact details are published in this map listing.")}</p>
                            )}
                          </div>
                          <a
                            className="service-centre-directions"
                            href={getServiceCentreDirectionsUrl(centre)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Navigation size={14} /> {t("Get directions")} <ArrowUpRight size={13} />
                          </a>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="service-centre-empty">
                    <MapPin size={20} />
                    <p>{t("No nearby centres were found in the map data. Try another nearby town or check the official CSC locator.")}</p>
                    <a href="https://locator.csccloud.in/" target="_blank" rel="noreferrer">
                      {t("Open official CSC locator")} <ExternalLink size={13} />
                    </a>
                    <a
                      href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(`${serviceArea} CSC government office`)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("Search OpenStreetMap directly")} <ExternalLink size={13} />
                    </a>
                  </div>
                )}
                <p className="service-centre-attribution">
                  {t("Location search by")} <a href="https://github.com/komoot/photon" target="_blank" rel="noreferrer">Photon</a> · {t("Map data")} <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>.
                </p>
              </div>
            )}
          </section>

          <footer className="page-footer">
            <span>{t("Built to make public support easier to reach.")}</span>
            <span><span className="footer-dot" /> {t("A community-first project")}</span>
          </footer>
        </div>
      </motion.main>

      <AnimatePresence>
        {showInfo && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => { if (event.target === event.currentTarget) setShowInfo(false); }}
          >
            <motion.div
              className="info-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12 }}
            >
              <button className="modal-close" aria-label={t("Close dialog")} onClick={() => setShowInfo(false)}><X size={19} /></button>
              <div className="modal-icon"><Sparkles size={21} /></div>
              <div className="section-kicker">{t("A FRIENDLIER FIRST STEP")}</div>
              <h2 id="modal-title">{t("How Jan Sahayak works")}</h2>
              <p>{t("Answer a few optional questions and explore government schemes that could be relevant to you. We keep your answers in this browser session only.")}</p>
              <div className="modal-steps">
                <div><span>01</span><p><b>{t("Share a little")}</b> — {t("your state, age group, and what matters to you.")}</p></div>
                <div><span>02</span><p><b>{t("Explore options")}</b> — {t("review scheme summaries and official links.")}</p></div>
                <div><span>03</span><p><b>{t("Verify before applying")}</b> — {t("final eligibility is decided by each scheme authority.")}</p></div>
              </div>
              <button className="primary-button modal-action" onClick={() => setShowInfo(false)}>{t("Got it")} <Check size={16} /></button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedScheme && (
          <motion.div
            className="modal-backdrop scheme-detail-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                stopNarration();
                setSelectedSchemeId(null);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                stopNarration();
                setSelectedSchemeId(null);
              }
            }}
            tabIndex={-1}
          >
            <motion.div
              className="scheme-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="scheme-detail-title"
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12 }}
            >
              <button className="modal-close" aria-label={t("Close scheme details")} onClick={() => { stopNarration(); setSelectedSchemeId(null); }}>
                <X size={19} />
              </button>
              <div className="scheme-detail-heading">
                <div className={`scheme-icon ${selectedScheme.tone}`}><SelectedSchemeIcon size={25} /></div>
                <div>
                  <div className="section-kicker">{selectedScheme.category}</div>
                  <h2 id="scheme-detail-title">{selectedScheme.name}</h2>
                  <p><Building2 size={14} /> {selectedScheme.department}</p>
                </div>
              </div>
              <section className="simple-explanation">
                <span>{t("In simple words")}</span>
                <p>{selectedScheme.simpleExplanation}</p>
              </section>
              <div className="scheme-detail-grid">
                <section className="detail-section">
                  <h3>{t("Who can apply?")}</h3>
                  <p>{selectedScheme.audience}</p>
                </section>
                <section className="detail-section">
                  <h3>{t("Eligibility requirements")}</h3>
                  <p>{selectedScheme.eligibilityCriteria}</p>
                </section>
                <section className="detail-section">
                  <h3>{t("Benefits provided")}</h3>
                  <p>{selectedScheme.benefits}</p>
                </section>
                <section className="detail-section">
                  <h3><CalendarDays size={15} /> {t("Application deadline")}</h3>
                  <p>{selectedScheme.applicationDeadline}</p>
                </section>
                <section className="detail-section detail-section-steps">
                  <h3>{t("How to apply")}</h3>
                  <ol>{selectedScheme.applicationSteps.map((step) => <li key={step}>{step}</li>)}</ol>
                </section>
              </div>
              <details className="application-guidance" aria-labelledby="application-guidance-title">
                <summary className="application-guidance-heading">
                  <span className="application-guidance-heading-copy">
                    <h3 id="application-guidance-title">{t("Application guidance")}</h3>
                    <span>{t("Choose the official route available in your area. Application channels can change.")}</span>
                  </span>
                  <ChevronDown size={18} aria-hidden="true" />
                </summary>
                <div className="application-guidance-grid">
                  <article className="application-guide-card">
                    <div className="application-guide-icon"><ExternalLink size={16} /></div>
                    <h4>{t("Apply online")}</h4>
                    <p>{selectedScheme.applicationGuidance.online}</p>
                    <div className="application-guide-links">
                      {(selectedScheme.officialLinks || [{ label: t("Official scheme portal"), href: selectedScheme.href }]).map((link) => (
                        <a className="application-portal-link" key={link.href} href={link.href} target="_blank" rel="noreferrer">
                          <span>{link.label}</span>
                          <small>{t("Open official portal")} <ArrowUpRight size={12} /></small>
                        </a>
                      ))}
                    </div>
                  </article>
                  <article className="application-guide-card">
                    <div className="application-guide-icon"><Building2 size={16} /></div>
                    <h4>{t("Apply offline / in person")}</h4>
                    <p>{selectedScheme.applicationGuidance.offline}</p>
                  </article>
                  <article className="application-guide-card">
                    <div className="application-guide-icon"><Check size={16} /></div>
                    <h4>{t("After you submit")}</h4>
                    <p>{selectedScheme.applicationGuidance.afterSubmission}</p>
                  </article>
                </div>
              </details>
              <section className="document-checklist" aria-labelledby="document-checklist-title">
                <div className="checklist-heading">
                  <div>
                    <div className="section-kicker">{t("GET READY")}</div>
                    <h3 id="document-checklist-title">{t("Document checklist")}</h3>
                    <p>{t("Mark what you have. The list is indicative; confirm each requirement with the official scheme.")}</p>
                  </div>
                  <div className="checklist-progress-count">
                    <strong>{collectedDocumentCount}/{selectedSchemeDocuments.length}</strong>
                    <span>{t("collected")}</span>
                  </div>
                </div>
                <div
                  className="checklist-progress"
                  role="progressbar"
                  aria-label={t("Document collection progress")}
                  aria-valuemin={0}
                  aria-valuemax={selectedSchemeDocuments.length}
                  aria-valuenow={collectedDocumentCount}
                  aria-valuetext={`${collectedDocumentCount} ${t("of")} ${selectedSchemeDocuments.length} ${t("documents marked collected")}`}
                >
                  <span style={{ width: `${checklistProgress}%` }} />
                </div>
                <div className="checklist-items">
                  {selectedSchemeDocuments.map((document) => {
                    const isCollected = Boolean(selectedSchemeCollected[document.id]);
                    return (
                      <article className={`document-check-item ${isCollected ? "is-collected" : ""}`} key={document.id}>
                        <label className="document-check-label">
                          <input
                            className="sr-only"
                            type="checkbox"
                            checked={isCollected}
                            onChange={() => toggleCollectedDocument(selectedScheme.id, document.id)}
                          />
                          <span className="document-checkmark"><Check size={14} /></span>
                          <span className="document-title">
                            <strong>{document.name}</strong>
                            <small>{t(document.requirementLabel)}</small>
                          </span>
                        </label>
                        <div className="document-guidance">
                          <p><span>{t("WHERE TO GET IT")}</span>{document.whereToGet}</p>
                          <p><span>{t("GUIDANCE")}</span>{document.guidance}</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
                <p className="checklist-footnote">{t("Checklist progress is kept only for this page session. Never share passwords, PINs or one-time codes.")}</p>
              </section>
              <div className="scheme-detail-contact">
                <strong>{t("Contact information")}</strong>
                <p>{selectedScheme.contact}</p>
              </div>
              <div className="scheme-detail-actions">
                <button className="primary-button detail-portal-link narration-button" onClick={isSpeaking ? stopNarration : readKannadaNarration}>
                  {isSpeaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
                  {isSpeaking ? t("Stop narration") : t("Listen in Kannada")}
                </button>
              </div>
              <p className="narration-hint">{t("Voice availability depends on your browser or device.")}</p>
              {narrationStatus && <p className="narration-status" role="status">{narrationStatus}</p>}
              <p className="scheme-detail-disclaimer">{t("Information is a starting point, not an official decision. Benefits, eligibility, document lists and deadlines can change; confirm current details with the department before applying.")}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {createPortal(
        <div
          className={`scheme-chat-widget ${chatDragging ? "is-dragging" : ""}`}
          style={chatWidgetStyle}
        >
          <AnimatePresence>
            {chatOpen && (
              <motion.section
                className="scheme-chat-panel"
                id="scheme-chat-panel"
                style={chatPanelStyle}
                role="dialog"
                aria-labelledby="scheme-chat-title"
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
              >
              <header className="scheme-chat-header">
                <div className="scheme-chat-heading">
                  <span className="scheme-chat-avatar"><MessageCircle size={17} /></span>
                  <div>
                    <h2 id="scheme-chat-title">{t("Scheme Assistant")}</h2>
                    <p>{t("Answers from scheme records")}</p>
                  </div>
                </div>
                <button
                  className="scheme-chat-close"
                  type="button"
                  aria-label={t("Close assistant")}
                  onClick={() => setChatOpen(false)}
                >
                  <X size={18} />
                </button>
              </header>

              <div className="scheme-chat-disclaimer">
                <ShieldCheck size={15} />
                <div>
                  <p>{t("This prototype uses an indicative scheme list, not a live verified government database. Confirm eligibility and current rules with the official department.")}</p>
                  <p>{t("Do not enter sensitive personal details.")}</p>
                </div>
              </div>

              <div className="scheme-chat-feed" role="log" aria-live="polite" aria-relevant="additions">
                {chatMessages.length === 0 && (
                  <div className="scheme-chat-welcome">
                    <p>{t("Ask about schemes, benefits, documents, or how to apply.")}</p>
                    <div className="scheme-chat-prompts">
                      <span>{t("Suggested questions")}</span>
                      {[
                        "I'm a farmer earning ₹1 lakh a year. Which schemes should I check?",
                        "Are there scholarships for engineering students?",
                        "What benefits can a widow receive?",
                        "What documents do I need for PM-KISAN?",
                      ].map((prompt) => (
                        <button key={prompt} type="button" onClick={() => sendChatQuestion(prompt)}>
                          {t(prompt)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {chatMessages.map((message) => (
                  <div className={`scheme-chat-message ${message.role}`} key={message.id}>
                    <p>{message.text}</p>
                    {message.schemeIds?.map((schemeId) => {
                      const record = schemeCatalog.find((scheme) => scheme.id === schemeId);
                      if (!record) return null;
                      const localized = localizeScheme(record, language);
                      const SchemeIcon = record.icon;
                      const officialLink = record.officialLinks?.[0]?.href ?? record.href;
                      return (
                        <article className="chat-scheme-result" key={schemeId}>
                          <span className={`scheme-icon ${record.tone}`}><SchemeIcon size={18} /></span>
                          <div className="chat-scheme-result-content">
                            <strong>{localized.name}</strong>
                            <span>{localized.department}</span>
                            <div className="chat-scheme-result-actions">
                              <a href={officialLink} target="_blank" rel="noreferrer">
                                {localized.action} <ArrowUpRight size={13} />
                              </a>
                              <button type="button" onClick={() => { openSchemeDetails(schemeId); setChatOpen(false); }}>
                                {t("Scheme details")}
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ))}
                <div ref={chatMessagesEndRef} />
              </div>

              <form className="scheme-chat-form" onSubmit={submitChatQuestion}>
                <label className="sr-only" htmlFor="scheme-chat-input">{t("Ask a question")}</label>
                <input
                  id="scheme-chat-input"
                  type="text"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder={t("Ask a question")}
                  maxLength={500}
                  autoComplete="off"
                />
                <button type="submit" aria-label={t("Send message")} disabled={!chatInput.trim()}>
                  <ArrowRight size={17} />
                </button>
              </form>
              </motion.section>
            )}
          </AnimatePresence>
          <button
            ref={chatLauncherRef}
            className={`scheme-chat-launcher ${chatOpen ? "is-open" : ""}`}
            type="button"
            aria-label={chatOpen ? t("Close assistant") : t("Ask scheme assistant")}
            aria-describedby="scheme-chat-drag-hint"
            aria-expanded={chatOpen}
            aria-controls="scheme-chat-panel"
            aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight"
            title={t("Drag to move assistant")}
            onPointerDown={handleChatPointerDown}
            onPointerMove={handleChatPointerMove}
            onPointerUp={handleChatPointerUp}
            onPointerCancel={handleChatPointerCancel}
            onKeyDown={moveChatWithKeyboard}
            onClick={handleChatLauncherClick}
          >
            {chatOpen ? <X size={19} /> : <MessageCircle size={19} />}
            <span>{chatOpen ? t("Close assistant") : t("Ask scheme assistant")}</span>
            <Move className="scheme-chat-drag-handle" size={14} aria-hidden="true" />
            <span className="sr-only" id="scheme-chat-drag-hint">
              {t("Use Alt and arrow keys to move the assistant.")}
            </span>
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}

export default App;
