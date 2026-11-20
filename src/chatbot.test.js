import assert from "node:assert/strict";
import test from "node:test";
import { answerSchemeQuestion } from "./chatbot.js";
import { schemes } from "./data/schemes.js";

test("farmer question recommends a record to check without claiming eligibility", () => {
  const answer = answerSchemeQuestion(
    "I am a farmer earning ₹1 lakh annually. Which schemes should I check?",
  );

  assert.deepEqual(answer.schemeIds, ["farmers"]);
  assert.match(answer.text, /PM-KISAN/);
  assert.match(answer.text, /do not prove eligibility/i);
  assert.match(answer.text, /can't confirm eligibility/i);
});

test("engineering scholarship question explains that individual scholarship rules differ", () => {
  const answer = answerSchemeQuestion("Are there scholarships for engineering students?");

  assert.deepEqual(answer.schemeIds, ["education"]);
  assert.match(answer.text, /not one single scholarship/i);
  assert.match(answer.text, /course, institution, income and other rules/i);
  assert.match(answer.text, /can't confirm eligibility/i);
});

test("widow question does not infer eligibility from the old-age pension record", () => {
  const answer = answerSchemeQuestion("What benefits can a widow receive?");

  assert.deepEqual(answer.schemeIds, []);
  assert.match(answer.text, /do not include a confirmed widow-specific scheme/i);
  assert.match(answer.text, /widow status alone does not establish eligibility/i);
});

test("scheme document question returns the record's documents and collection guidance", () => {
  const answer = answerSchemeQuestion("What documents do I need for PM-KISAN?");
  const farmerScheme = schemes.find((scheme) => scheme.id === "farmers");

  assert.deepEqual(answer.schemeIds, ["farmers"]);
  for (const document of farmerScheme.requiredDocuments) {
    assert.ok(answer.text.includes(document.name));
    assert.ok(answer.text.includes(document.whereToGet));
  }
  assert.match(answer.text, /document list is indicative/i);
});

test("application questions return the localized record steps and a scheme link target", () => {
  const answer = answerSchemeQuestion("How do I apply for PM-KISAN?");
  const farmerScheme = schemes.find((scheme) => scheme.id === "farmers");

  assert.deepEqual(answer.schemeIds, ["farmers"]);
  assert.ok(answer.text.includes(farmerScheme.applicationGuidance.online));
  assert.ok(answer.text.includes(farmerScheme.applicationGuidance.offline));
  assert.ok(answer.text.includes(farmerScheme.applicationGuidance.afterSubmission));
});

test("localized farmer and widow questions receive localized, cautious responses", () => {
  const farmerAnswer = answerSchemeQuestion("मैं किसान हूँ, कौन-सी योजनाएँ जाँचूँ?", "hi");
  const widowAnswer = answerSchemeQuestion("ವಿಧವೆಯರಿಗೆ ಯಾವ ನೆರವು ಸಿಗಬಹುದು?", "kn");

  assert.deepEqual(farmerAnswer.schemeIds, ["farmers"]);
  assert.match(farmerAnswer.text, /पात्रता साबित नहीं होती/);
  assert.deepEqual(widowAnswer.schemeIds, []);
  assert.match(widowAnswer.text, /ದೃಢೀಕರಿಸಿದ ಯೋಜನೆ ಇಲ್ಲ/);
});

test("unsupported questions ask for more context without inventing a scheme", () => {
  const answer = answerSchemeQuestion("Will I receive a government grant next month?");

  assert.deepEqual(answer.schemeIds, []);
  assert.match(answer.text, /don't have enough details/i);
});

test("assistant answers from an admin-added scheme catalog", () => {
  const customScheme = {
    ...schemes[0],
    id: "community-food-support",
    name: "Community Food Support",
    simpleExplanation: "This local listing describes food support.",
    benefits: "Food assistance may be available.",
  };
  const answer = answerSchemeQuestion(
    "What benefits are available for Community Food Support?",
    "en",
    null,
    [customScheme],
  );

  assert.deepEqual(answer.schemeIds, ["community-food-support"]);
  assert.match(answer.text, /Food assistance may be available/);
});

test("scholarship questions remain safe if the scholarship listing is removed", () => {
  const answer = answerSchemeQuestion("Are there scholarships?", "en", null, []);

  assert.deepEqual(answer.schemeIds, []);
  assert.match(answer.text, /don't have a scholarship listing/i);
});
