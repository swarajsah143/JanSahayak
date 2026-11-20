import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Check,
  FileText,
  Languages,
  LayoutDashboard,
  MessageSquareText,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { categories, schemes as defaultSchemes } from "./data/schemes.js";
import "./admin.css";

const adminSections = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "schemes", label: "Manage schemes", icon: BookOpen },
  { id: "users", label: "Manage users", icon: Users },
  { id: "eligibility", label: "Eligibility rules", icon: ShieldCheck },
  { id: "languages", label: "Manage languages", icon: Languages },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "feedback", label: "Feedback", icon: MessageSquareText },
];

const supportedLanguages = [
  { name: "English", detail: "Default interface and scheme summaries" },
  { name: "ಕನ್ನಡ · Kannada", detail: "Translated interface and scheme summaries" },
  { name: "हिन्दी · Hindi", detail: "Translated interface and scheme summaries" },
];

const emptyDraft = {
  name: "",
  department: "",
  category: "",
  description: "",
  simpleExplanation: "",
  overview: "",
  audience: "",
  eligibilityCriteria: "",
  benefits: "",
  deadlineLabel: "",
  applicationDeadline: "",
  documentNames: "",
  applicationSteps: "",
  contact: "",
  action: "",
  href: "",
};

function createDraft(scheme) {
  if (!scheme) return { ...emptyDraft };
  return {
    name: scheme.name ?? "",
    department: scheme.department ?? "",
    category: scheme.category ?? "",
    description: scheme.description ?? "",
    simpleExplanation: scheme.simpleExplanation ?? "",
    overview: scheme.overview ?? "",
    audience: scheme.audience ?? "",
    eligibilityCriteria: scheme.eligibilityCriteria ?? "",
    benefits: scheme.benefits ?? "",
    deadlineLabel: scheme.deadlineLabel ?? "",
    applicationDeadline: scheme.applicationDeadline ?? "",
    documentNames: (scheme.requiredDocuments ?? []).map((document) => document.name).join("\n"),
    applicationSteps: (scheme.applicationSteps ?? []).join("\n"),
    contact: scheme.contact ?? "",
    action: scheme.action ?? "",
    href: scheme.href ?? "",
  };
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getSafeWebsiteUrl(value) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) {
    throw new Error("Enter an official website that starts with https:// or http://.");
  }
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(candidate);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Enter an official website that starts with https:// or http://.");
  }
  return url.href;
}

function splitLines(value) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function getPlaceholderContent(section) {
  const content = {
    users: {
      icon: Users,
      title: "User accounts are not connected",
      description: "Sign-in and registration are front-end demonstrations and do not create or save real accounts. There are no user records to view or manage.",
      note: "A secure server-side identity provider and role checks are required before enabling account administration.",
    },
    eligibility: {
      icon: ShieldCheck,
      title: "Eligibility rules are informational only",
      description: "The current checker uses fixed prototype guidance in the application code. It does not confirm eligibility and does not have an editable rules database.",
      note: "Rule changes should be verified against current official scheme guidance before they are used for recommendations.",
    },
    languages: {
      icon: Languages,
      title: "Languages available in this demo",
      description: "The site currently provides English, Kannada and Hindi. Translation content is stored in the application source, not managed from this screen.",
      note: "Review Kannada and Hindi copy with fluent speakers and the relevant official scheme sources before publication.",
    },
    analytics: {
      icon: BarChart3,
      title: "No usage analytics are collected",
      description: "This prototype does not store searches, recommendations or individual activity. The counts on the overview describe the local scheme catalog only.",
      note: "Do not add personal or sensitive profile data to analytics. A production setup should use privacy-reviewed, aggregated measures.",
    },
    feedback: {
      icon: MessageSquareText,
      title: "Feedback inbox is not connected",
      description: "There is no feedback submission form or saved feedback data in the current website.",
      note: "Connect a reviewed feedback form and a secure store before collecting messages from citizens.",
    },
  };
  return content[section];
}

function PlaceholderPanel({ section }) {
  const content = getPlaceholderContent(section);
  const Icon = content.icon;
  return (
    <section className="admin-placeholder-card">
      <span className="admin-placeholder-icon"><Icon size={22} /></span>
      <h2>{content.title}</h2>
      <p>{content.description}</p>
      {section === "languages" && (
        <ul className="admin-language-list">
          {supportedLanguages.map((language) => (
            <li key={language.name}>
              <span><strong>{language.name}</strong><small>{language.detail}</small></span>
              <span className="admin-status-pill">Available</span>
            </li>
          ))}
        </ul>
      )}
      <div className="admin-inline-note"><ShieldAlert size={16} /> {content.note}</div>
    </section>
  );
}

function SchemeForm({ scheme, catalog, onCancel, onSave }) {
  const [draft, setDraft] = useState(() => createDraft(scheme));
  const [error, setError] = useState("");

  const updateDraft = (event) => {
    setDraft((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const submit = (event) => {
    event.preventDefault();
    setError("");

    const name = draft.name.trim();
    const id = scheme?.id ?? (slugify(name) || `scheme-${Date.now()}`);
    if (!name || !draft.department.trim() || !draft.category) {
      setError("Enter the scheme name, department and category.");
      return;
    }
    const normalizedName = name.toLocaleLowerCase();
    if (catalog.some((item) =>
      item.id !== scheme?.id &&
      (item.id === id || item.name.trim().toLocaleLowerCase() === normalizedName),
    )) {
      setError("A scheme with this name already exists. Choose a different name.");
      return;
    }

    let href;
    try {
      href = getSafeWebsiteUrl(draft.href.trim());
    } catch (urlError) {
      if (urlError instanceof TypeError) {
        setError("Enter a valid official website URL.");
        return;
      }
      throw urlError;
    }

    const template = defaultSchemes.find((item) => item.category === draft.category)
      ?? catalog.find((item) => item.category === draft.category)
      ?? catalog[0];
    if (!template) {
      setError("Add at least one base scheme before creating a new record.");
      return;
    }
    const documents = splitLines(draft.documentNames).map((documentName, index) => {
      const oldDocument = scheme?.requiredDocuments?.find((item) => item.name === documentName);
      return oldDocument ?? {
        id: `${id}-document-${index + 1}`,
        name: documentName,
        requirementLabel: "Confirm if required",
        whereToGet: "Check with the relevant department or official scheme portal.",
        guidance: "Confirm the current document requirements before collecting or submitting records.",
      };
    });
    const applicationSteps = splitLines(draft.applicationSteps);
    const savedScheme = {
      ...(scheme ?? {}),
      id,
      name,
      department: draft.department.trim(),
      category: draft.category,
      icon: scheme?.category === draft.category ? scheme.icon : template.icon,
      tone: scheme?.category === draft.category ? scheme.tone : template.tone,
      description: draft.description.trim(),
      simpleExplanation: draft.simpleExplanation.trim() || draft.description.trim(),
      overview: draft.overview.trim() || draft.description.trim(),
      audience: draft.audience.trim() || "Confirm the applicant conditions with the official scheme authority.",
      eligibilityCriteria: draft.eligibilityCriteria.trim() || "Check the current eligibility criteria with the official scheme authority.",
      benefits: draft.benefits.trim() || "Confirm current benefits with the official scheme authority.",
      deadlineLabel: draft.deadlineLabel.trim() || "Check official portal",
      applicationDeadline: draft.applicationDeadline.trim() || "Check the current application timeline with the official scheme authority.",
      requiredDocuments: documents,
      applicationSteps: applicationSteps.length ? applicationSteps : ["Check current instructions with the official scheme authority."],
      applicationGuidance: scheme?.applicationGuidance ?? {
        online: "Open the official portal and follow its current application instructions.",
        offline: "Ask the relevant department or local office whether in-person support is available.",
        afterSubmission: "Keep the application reference and follow official status updates.",
      },
      contact: draft.contact.trim() || "Use the contact information published on the official scheme portal.",
      action: draft.action.trim() || "Visit official portal",
      href,
    };

    const nextCatalog = scheme
      ? catalog.map((item) => item.id === scheme.id ? savedScheme : item)
      : [...catalog, savedScheme];
    if (onSave(nextCatalog)) onCancel();
  };

  return (
    <form className="admin-scheme-form" onSubmit={submit}>
      <div className="admin-form-heading">
        <div>
          <span className="admin-eyebrow">{scheme ? "EDIT RECORD" : "NEW RECORD"}</span>
          <h3>{scheme ? "Update scheme information" : "Add a scheme"}</h3>
        </div>
        <button className="admin-icon-button" type="button" onClick={onCancel} aria-label="Close scheme form"><X size={18} /></button>
      </div>
      {error && <p className="admin-form-error" role="alert">{error}</p>}
      <div className="admin-form-grid">
        <label className="admin-field">
          Scheme name
          <input name="name" value={draft.name} onChange={updateDraft} required />
        </label>
        <label className="admin-field">
          Government department
          <input name="department" value={draft.department} onChange={updateDraft} required />
        </label>
        <label className="admin-field">
          Category
          <select name="category" value={draft.category} onChange={updateDraft} required>
            <option value="">Choose category</option>
            {categories.filter((category) => category !== "All schemes").map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          Card summary
          <input name="description" value={draft.description} onChange={updateDraft} required />
        </label>
        <label className="admin-field">
          Benefits
          <textarea name="benefits" value={draft.benefits} onChange={updateDraft} rows="3" />
        </label>
        <label className="admin-field">
          Eligibility criteria
          <textarea name="eligibilityCriteria" value={draft.eligibilityCriteria} onChange={updateDraft} rows="3" />
        </label>
        <label className="admin-field">
          Who can apply?
          <textarea name="audience" value={draft.audience} onChange={updateDraft} rows="2" />
        </label>
        <label className="admin-field">
          Plain-language explanation
          <textarea name="simpleExplanation" value={draft.simpleExplanation} onChange={updateDraft} rows="2" />
        </label>
        <label className="admin-field">
          Scheme overview
          <textarea name="overview" value={draft.overview} onChange={updateDraft} rows="2" />
        </label>
        <label className="admin-field">
          Deadline label
          <input name="deadlineLabel" value={draft.deadlineLabel} onChange={updateDraft} placeholder="Check official portal" />
        </label>
        <label className="admin-field">
          Deadline details
          <textarea name="applicationDeadline" value={draft.applicationDeadline} onChange={updateDraft} rows="2" />
        </label>
        <label className="admin-field">
          Official website
          <input name="href" type="url" value={draft.href} onChange={updateDraft} placeholder="https://example.gov.in" required />
        </label>
        <label className="admin-field">
          Required documents <small>One item per line</small>
          <textarea name="documentNames" value={draft.documentNames} onChange={updateDraft} rows="3" />
        </label>
        <label className="admin-field">
          Application steps <small>One step per line</small>
          <textarea name="applicationSteps" value={draft.applicationSteps} onChange={updateDraft} rows="3" />
        </label>
        <label className="admin-field">
          Contact information
          <textarea name="contact" value={draft.contact} onChange={updateDraft} rows="2" />
        </label>
        <label className="admin-field">
          Official link button label
          <input name="action" value={draft.action} onChange={updateDraft} placeholder="Visit official portal" />
        </label>
      </div>
      <p className="admin-form-hint">Only use information checked against the official department. This demo saves changes in this browser only.</p>
      <div className="admin-form-actions">
        <button className="admin-secondary-button" type="button" onClick={onCancel}>Cancel</button>
        <button className="admin-primary-button" type="submit"><Save size={15} /> Save scheme</button>
      </div>
    </form>
  );
}

export default function AdminDashboard({ catalog, onCatalogSave, onBack, storageError }) {
  const [activeSection, setActiveSection] = useState("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [schemeSearch, setSchemeSearch] = useState("");
  const [editingScheme, setEditingScheme] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");

  const categoryCount = new Set(catalog.map((scheme) => scheme.category)).size;
  const visibleCatalog = useMemo(() => {
    const query = schemeSearch.trim().toLowerCase();
    if (!query) return catalog;
    return catalog.filter((scheme) =>
      `${scheme.name} ${scheme.category} ${scheme.department}`.toLowerCase().includes(query),
    );
  }, [catalog, schemeSearch]);

  const openNewScheme = () => {
    setEditingScheme(null);
    setFormOpen(true);
    setStatusMessage("");
  };

  const openEditScheme = (scheme) => {
    setEditingScheme(scheme);
    setFormOpen(true);
    setStatusMessage("");
  };

  const closeForm = () => {
    setEditingScheme(null);
    setFormOpen(false);
  };

  const deleteScheme = (schemeId) => {
    if (onCatalogSave(catalog.filter((scheme) => scheme.id !== schemeId))) {
      setPendingDeleteId(null);
      setStatusMessage("Scheme removed from this browser's demo catalog.");
    }
  };

  const changeSection = (section) => {
    setActiveSection(section);
    setMobileNavOpen(false);
    setStatusMessage("");
    closeForm();
  };

  const activeSectionLabel = adminSections.find((section) => section.id === activeSection)?.label;
  const currentSection = activeSection === "overview" ? (
    <OverviewPanel
      catalogCount={catalog.length}
      categoryCount={categoryCount}
      onOpenSection={changeSection}
    />
  ) : activeSection === "schemes" ? (
    <section className="admin-section-panel">
      <div className="admin-section-heading">
        <div>
          <span className="admin-eyebrow">LOCAL CATALOG</span>
          <h2>Government schemes</h2>
          <p>Add, update or remove records shown in the public scheme directory.</p>
        </div>
        <button className="admin-primary-button" type="button" onClick={openNewScheme}><Plus size={16} /> Add scheme</button>
      </div>
      {formOpen && (
        <SchemeForm
          key={editingScheme?.id ?? "new"}
          scheme={editingScheme}
          catalog={catalog}
          onCancel={closeForm}
          onSave={(nextCatalog) => {
            if (!onCatalogSave(nextCatalog)) return false;
            setStatusMessage(editingScheme ? "Scheme updated in this browser's demo catalog." : "Scheme added to this browser's demo catalog.");
            return true;
          }}
        />
      )}
      {statusMessage && <p className="admin-status-message" role="status"><Check size={15} /> {statusMessage}</p>}
      <div className="admin-catalog-toolbar">
        <label className="admin-search">
          <Search size={16} />
          <span className="sr-only">Search schemes</span>
          <input value={schemeSearch} onChange={(event) => setSchemeSearch(event.target.value)} placeholder="Search name, category or department" />
        </label>
        <span>{visibleCatalog.length} of {catalog.length} schemes</span>
      </div>
      <div className="admin-scheme-list">
        {visibleCatalog.map((scheme) => (
          <article className="admin-scheme-row" key={scheme.id}>
            <div className="admin-scheme-row-main">
              <span className="admin-scheme-category">{scheme.category}</span>
              <h3>{scheme.name}</h3>
              <p>{scheme.department}</p>
              <small>{scheme.benefits}</small>
            </div>
            <div className="admin-scheme-row-actions">
              {pendingDeleteId === scheme.id ? (
                <div className="admin-delete-confirm" role="group" aria-label={`Confirm deleting ${scheme.name}`}>
                  <span>Remove this scheme?</span>
                  <button type="button" onClick={() => deleteScheme(scheme.id)}>Remove</button>
                  <button type="button" onClick={() => setPendingDeleteId(null)}>Cancel</button>
                </div>
              ) : (
                <>
                  <button className="admin-secondary-button" type="button" onClick={() => openEditScheme(scheme)}><Pencil size={14} /> Edit</button>
                  <button className="admin-danger-button" type="button" onClick={() => { setPendingDeleteId(scheme.id); setStatusMessage(""); }} aria-label={`Delete ${scheme.name}`}><Trash2 size={14} /></button>
                </>
              )}
            </div>
          </article>
        ))}
        {visibleCatalog.length === 0 && <p className="admin-empty-state">No schemes match that search.</p>}
      </div>
    </section>
  ) : (
    <PlaceholderPanel section={activeSection} />
  );

  return (
    <div className="admin-page" lang="en">
      <aside className={`admin-sidebar ${mobileNavOpen ? "admin-sidebar-open" : ""}`}>
        <a className="admin-brand" href="#admin" onClick={(event) => { event.preventDefault(); changeSection("overview"); }}>
          <span className="brand-mark"><ShieldCheck size={20} /></span>
          <span>jan<span className="brand-light">sahayak</span></span>
        </a>
        <p className="admin-sidebar-label">ADMIN CONSOLE · DEMO</p>
        <nav className="admin-nav" aria-label="Admin navigation">
          {adminSections.map(({ id, label, icon: Icon }) => (
            <button
              className={`admin-nav-item ${activeSection === id ? "active" : ""}`}
              type="button"
              key={id}
              aria-current={activeSection === id ? "page" : undefined}
              onClick={() => changeSection(id)}
            >
              <Icon size={17} /> <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-note"><ShieldAlert size={15} /> Demo only. This screen is not protected by admin sign-in.</div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <button className="admin-mobile-toggle" type="button" aria-label={mobileNavOpen ? "Close admin navigation" : "Open admin navigation"} onClick={() => setMobileNavOpen((open) => !open)}>
            {mobileNavOpen ? <X size={19} /> : <LayoutDashboard size={19} />}
          </button>
          <div className="admin-breadcrumb">Jan Sahayak <span>/</span> <b>{activeSectionLabel}</b></div>
          <div className="admin-topbar-actions">
            <span className="admin-demo-badge"><span /> Prototype mode</span>
            <button className="admin-exit-button" type="button" onClick={onBack}><ArrowLeft size={15} /> Back to website</button>
          </div>
        </header>
        <div className="admin-content">
          <div className="admin-page-heading">
            <div>
              <span className="admin-eyebrow">JAN SAHAYAK · ADMINISTRATION</span>
              <h1>{activeSection === "overview" ? "Admin dashboard" : activeSectionLabel}</h1>
              <p>Manage the demo scheme directory and review which admin features still need a secure backend.</p>
            </div>
          </div>
          {storageError && (
            <div className="admin-storage-warning" role="alert">
              <ShieldAlert size={17} /> The saved demo catalog could not be read or changed. Check this browser's storage and reload before continuing.
            </div>
          )}
          <div className="admin-prototype-banner">
            <ShieldAlert size={17} />
            <p><strong>Prototype admin panel</strong> — changes to schemes are stored only in this browser. User accounts, analytics, eligibility rules, translations and feedback are not connected to a backend.</p>
          </div>
          {currentSection}
        </div>
      </main>
    </div>
  );
}

function OverviewPanel({ catalogCount, categoryCount, onOpenSection }) {
  return (
    <>
      <section className="admin-metric-grid" aria-label="Demo catalog summary">
        <article className="admin-metric-card"><span className="admin-metric-icon mint"><BookOpen size={18} /></span><small>Scheme records</small><strong>{catalogCount}</strong><span>Saved in this browser</span></article>
        <article className="admin-metric-card"><span className="admin-metric-icon peach"><LayoutDashboard size={18} /></span><small>Categories used</small><strong>{categoryCount}</strong><span>From the local catalog</span></article>
        <article className="admin-metric-card"><span className="admin-metric-icon lavender"><Languages size={18} /></span><small>Languages</small><strong>3</strong><span>English · Kannada · Hindi</span></article>
      </section>
      <section className="admin-overview-panel">
        <div className="admin-section-heading">
          <div><span className="admin-eyebrow">ADMIN TOOLS</span><h2>Choose what to manage</h2></div>
        </div>
        <div className="admin-overview-links">
          {adminSections.slice(1).map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => onOpenSection(id)}>
              <span><Icon size={17} /> {label}</span><ArrowLeft size={15} className="admin-overview-arrow" />
            </button>
          ))}
        </div>
        <div className="admin-inline-note"><FileText size={16} /> Catalog edits change scheme listings on this device only. They are not verified government updates and are not shared with other users.</div>
      </section>
    </>
  );
}
