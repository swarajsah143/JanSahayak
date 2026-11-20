import assert from "node:assert/strict";
import test from "node:test";
import { schemes } from "./schemes.js";

test("scheme document checklists have unique IDs and applicant guidance", () => {
  for (const scheme of schemes) {
    const documents = scheme.requiredDocuments;
    const documentIds = documents.map((document) => document.id);

    assert.ok(documents.length > 0, `${scheme.id} should have checklist documents`);
    assert.equal(new Set(documentIds).size, documents.length, `${scheme.id} document IDs should be unique`);
    for (const step of ["online", "offline", "afterSubmission"]) {
      assert.equal(typeof scheme.applicationGuidance[step], "string");
      assert.ok(scheme.applicationGuidance[step].length > 0);
    }

    for (const document of documents) {
      assert.equal(typeof document.name, "string");
      assert.equal(typeof document.requirementLabel, "string");
      assert.equal(typeof document.whereToGet, "string");
      assert.equal(typeof document.guidance, "string");
    }
  }
});
