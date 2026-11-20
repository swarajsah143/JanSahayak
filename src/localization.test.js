import assert from "node:assert/strict";
import test from "node:test";
import { schemes } from "./data/schemes.js";
import { kannadaUi, hindiUi, localizeScheme, translate } from "./localization.js";

test("Kannada and Hindi localizations cover scheme details and document guidance", () => {
  for (const language of ["kn", "hi"]) {
    for (const scheme of schemes) {
      const localized = localizeScheme(scheme, language);

      for (const field of ["name", "category", "department", "description", "simpleExplanation", "overview", "audience", "eligibilityCriteria", "benefits", "deadlineLabel", "applicationDeadline", "contact", "action"]) {
        assert.notEqual(localized[field], scheme[field], `${language}: ${scheme.id}.${field} should be translated`);
      }

      assert.equal(localized.requiredDocuments.length, scheme.requiredDocuments.length);
      localized.requiredDocuments.forEach((document, index) => {
        assert.equal(document.id, scheme.requiredDocuments[index].id);
        assert.notEqual(document.name, scheme.requiredDocuments[index].name);
        assert.notEqual(document.whereToGet, scheme.requiredDocuments[index].whereToGet);
        assert.notEqual(document.guidance, scheme.requiredDocuments[index].guidance);
      });
      assert.notDeepEqual(localized.applicationSteps, scheme.applicationSteps);
      for (const step of ["online", "offline", "afterSubmission"]) {
        assert.notEqual(
          localized.applicationGuidance[step],
          scheme.applicationGuidance[step],
          `${language}: ${scheme.id}.applicationGuidance.${step} should be translated`,
        );
      }
    }
  }
});

test("Hindi covers every existing Kannada UI translation key", () => {
  for (const key of Object.keys(kannadaUi)) {
    assert.ok(key in hindiUi, `Hindi translation is missing: ${key}`);
  }
});

test("English remains the default and supported locales translate UI strings", () => {
  assert.equal(translate("Document checklist", "en"), "Document checklist");
  assert.equal(translate("Document checklist", "kn"), "ದಾಖಲೆಗಳ ಪಟ್ಟಿ");
  assert.equal(translate("Document checklist", "hi"), "दस्तावेज़ों की सूची");
});

test("admin-added schemes retain their application guidance when localized", () => {
  const customScheme = {
    ...schemes[0],
    id: "custom-support",
    name: "Custom support",
    applicationGuidance: {
      online: "Open the custom portal.",
      offline: "Visit the local office.",
      afterSubmission: "Keep the reference number.",
    },
  };

  for (const language of ["kn", "hi"]) {
    const localized = localizeScheme(customScheme, language);
    assert.equal(localized.name, customScheme.name);
    assert.deepEqual(localized.applicationGuidance, customScheme.applicationGuidance);
  }
});

test("nearby-centre search guidance is available in Kannada and Hindi", () => {
  for (const key of [
    "Nearby government service centres",
    "I understand this area will be sent to Photon and OpenStreetMap for this search.",
    "Enter only a town, district, or PIN code, not a home or street address. Results use an approximate point for that area; this app does not save the search.",
    "Open official CSC locator",
    "Search OpenStreetMap directly",
    "Get directions",
  ]) {
    assert.notEqual(translate(key, "kn"), key, `Kannada translation is missing: ${key}`);
    assert.notEqual(translate(key, "hi"), key, `Hindi translation is missing: ${key}`);
  }
});

test("smart notification labels and guidance are available in Kannada and Hindi", () => {
  for (const key of [
    "Smart notifications",
    "Close notifications",
    "Upcoming application deadline",
    "Incomplete document checklist",
    "New scheme matching your profile",
    "Scheme information changed",
    "An application deadline for {scheme} is coming up on {date}. Confirm the date with the official department.",
    "Your document checklist for {scheme} is incomplete: {collected} of {total} marked collected.",
    "A new scheme, {scheme}, may match your profile signals. Check its official criteria.",
    "Information for {scheme} changed in this app's scheme catalog. Verify details with the official department.",
    "Reminders appear only while this page is open. No browser push, email, or SMS is sent.",
    "No reminders right now",
    "Start a checklist or run the profile checker to personalize reminders.",
    "Exact date reminders require a date in the catalog; this demo has no verified date-specific deadlines.",
    "Scheme update alerts compare the demo catalog using a non-personal browser snapshot; they do not track live government changes.",
    "Scheme update tracking is unavailable in this browser.",
    "Mark scheme updates as seen",
  ]) {
    assert.notEqual(translate(key, "kn"), key, `Kannada translation is missing: ${key}`);
    assert.notEqual(translate(key, "hi"), key, `Hindi translation is missing: ${key}`);
  }
});

test("profile-match explanations are translated into Kannada and Hindi", () => {
  for (const key of [
    "Profile match explanations",
    "Recommended scheme",
    "Potential match",
    "Why this scheme may match your profile",
    "This is a preliminary profile match, not a confirmed eligibility decision. Confirm scheme-specific conditions with the official department.",
    "Your social category is included as context because some scholarships have category-specific requirements.",
    "Your reported income range may matter for some scholarships; each scholarship has its own rules.",
  ]) {
    assert.notEqual(translate(key, "kn"), key, `Kannada translation is missing: ${key}`);
    assert.notEqual(translate(key, "hi"), key, `Hindi translation is missing: ${key}`);
  }
});

test("assistant movement hints are translated into Kannada and Hindi", () => {
  for (const key of [
    "Drag to move assistant",
    "Use Alt and arrow keys to move the assistant.",
  ]) {
    assert.notEqual(translate(key, "kn"), key, `Kannada translation is missing: ${key}`);
    assert.notEqual(translate(key, "hi"), key, `Hindi translation is missing: ${key}`);
  }
});
