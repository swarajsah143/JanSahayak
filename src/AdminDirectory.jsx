import { useEffect, useState } from "react";
import { ArrowLeft, Building2, Landmark, ShieldCheck, Users } from "lucide-react";
import { apiRequest } from "./api.js";

const emptyDraft = {
  displayName: "",
  roleTitle: "",
  department: "",
  publicContact: "",
};

function getErrorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

export default function AdminDirectory({ account, apiConfigured, language, onBack, t }) {
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(apiConfigured);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState(emptyDraft);
  const [editorError, setEditorError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!apiConfigured) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    const loadDirectory = async () => {
      setLoading(true);
      setLoadError("");
      setEditorError("");

      try {
        const { directory: entries } = await apiRequest("/admin-directory");
        if (active) setDirectory(entries);

        if (account?.role === "admin") {
          const { profile } = await apiRequest("/admin-directory/me");
          if (active) {
            setDraft(profile
              ? {
                  displayName: profile.displayName,
                  roleTitle: profile.roleTitle,
                  department: profile.department,
                  publicContact: profile.publicContact,
                }
              : { ...emptyDraft, displayName: account.fullName });
          }
        }
      } catch (error) {
        console.error("Could not load administrator directory data.", error);
        if (active) setLoadError(getErrorMessage(error, t("Could not load the admin directory.")));
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadDirectory();
    return () => {
      active = false;
    };
  }, [account, apiConfigured, reloadToken, t]);

  const updateDraft = (event) => {
    setDraft((current) => ({ ...current, [event.target.name]: event.target.value }));
    setEditorError("");
    setSavedMessage("");
  };

  const saveDirectoryProfile = async (event) => {
    event.preventDefault();
    if (!apiConfigured || account?.role !== "admin") {
      setEditorError(t("Administrator access is required."));
      return;
    }

    setSaving(true);
    setEditorError("");
    setSavedMessage("");
    try {
      await apiRequest("/admin-directory/me", {
        method: "PUT",
        body: JSON.stringify({
          displayName: draft.displayName.trim(),
          roleTitle: draft.roleTitle.trim(),
          department: draft.department.trim(),
          publicContact: draft.publicContact.trim(),
        }),
      });
      setSavedMessage(t("Admin directory details saved."));
      setReloadToken((current) => current + 1);
    } catch (error) {
      console.error("Could not save the admin directory profile.", error);
      setEditorError(getErrorMessage(error, t("Could not save your public admin profile.")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="account-page admin-directory-page" lang={language}>
      <div className="account-orb account-orb-one" />
      <div className="account-orb account-orb-two" />
      <header className="account-header">
        <a className="account-brand" href="#home" onClick={(event) => { event.preventDefault(); onBack(); }}>
          <span className="brand-mark"><Landmark size={21} /></span>
          <span>jan<span className="brand-light">sahayak</span></span>
        </a>
        <button className="account-back" type="button" onClick={onBack}>
          <ArrowLeft size={15} /> {t("Back to overview")}
        </button>
      </header>

      <main className="account-card admin-directory-card">
        <div className="account-icon"><Users size={21} /></div>
        <div className="section-kicker">{t("PUBLIC CONTACTS")}</div>
        <h1 className="account-title">{t("Admin directory")}</h1>
        <p className="account-copy">{t("Public admin contact details are available to everyone. Private account information is never shown here.")}</p>

        {!apiConfigured ? (
          <div className="auth-feedback is-error" role="status">
            <ShieldCheck size={16} /> {t("Admin directory requires MongoDB Atlas setup before it can load.")}
          </div>
        ) : loading ? (
          <p className="admin-directory-status" role="status">{t("Loading administrator contacts…")}</p>
        ) : loadError ? (
          <div className="auth-feedback is-error" role="alert">{loadError}</div>
        ) : directory.length > 0 ? (
          <div className="admin-directory-list">
            {directory.map((entry, index) => (
              <article
                className="admin-directory-entry"
                key={`${entry.displayName}:${entry.roleTitle}:${entry.department}:${index}`}
              >
                <span className="admin-directory-entry-icon"><ShieldCheck size={18} /></span>
                <div>
                  <h2>{entry.displayName}</h2>
                  <p>{entry.roleTitle}</p>
                  <span><Building2 size={14} /> {entry.department}</span>
                  {entry.publicContact && <span className="admin-directory-contact">{entry.publicContact}</span>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="admin-directory-empty">
            <ShieldCheck size={20} />
            <p>{t("No public admin contact profiles have been published yet.")}</p>
          </div>
        )}

        {account?.role === "admin" && apiConfigured && !loading && !loadError && (
          <form className="admin-directory-editor" onSubmit={saveDirectoryProfile}>
            <div className="admin-directory-editor-heading">
              <ShieldCheck size={17} />
              <h2>{t("Edit your public admin profile")}</h2>
            </div>
            <label className="field">
              <span>{t("Public display name")}</span>
              <input
                name="displayName"
                value={draft.displayName}
                onChange={updateDraft}
                maxLength={120}
                required
              />
            </label>
            <label className="field">
              <span>{t("Role / title")}</span>
              <input
                name="roleTitle"
                value={draft.roleTitle}
                onChange={updateDraft}
                maxLength={120}
                required
              />
            </label>
            <label className="field">
              <span>{t("Department")}</span>
              <input
                name="department"
                value={draft.department}
                onChange={updateDraft}
                maxLength={160}
                required
              />
            </label>
            <label className="field">
              <span>{t("Official public contact")}</span>
              <input
                name="publicContact"
                value={draft.publicContact}
                onChange={updateDraft}
                maxLength={240}
                placeholder={t("Optional; only use contact details meant for publication")}
              />
            </label>
            {editorError && <p className="auth-feedback is-error" role="alert">{editorError}</p>}
            {savedMessage && <p className="auth-feedback is-success" role="status">{savedMessage}</p>}
            <button className="primary-button account-submit" type="submit" disabled={saving}>
              {saving ? t("Saving…") : t("Save public details")}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
