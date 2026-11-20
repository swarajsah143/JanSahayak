import assert from "node:assert/strict";
import test from "node:test";
import { evaluateSchemeEligibility, getEligibilityStatusLabel } from "./eligibility.js";

test("farmer and student signals rank related schemes without confirming eligibility", () => {
  const farmer = evaluateSchemeEligibility("farmers", { occupation: "Farmer" });
  const student = evaluateSchemeEligibility("education", { occupation: "Student" });

  assert.equal(farmer.status, "possible");
  assert.equal(student.status, "possible");
  assert.ok(farmer.relevanceScore > evaluateSchemeEligibility("education", { occupation: "Farmer" }).relevanceScore);
  assert.match(farmer.relevanceReasons[0], /does not confirm/i);
});

test("missing or non-matching occupation never becomes a negative eligibility decision", () => {
  const result = evaluateSchemeEligibility("farmers", { occupation: "Student" });

  assert.equal(result.status, "needs-verification");
  assert.match(result.relevanceReasons[0], /not a rejection/i);
});

test("additional scheme categories return scheme-specific verification guidance", () => {
  const financial = evaluateSchemeEligibility("financial", { occupation: "Self-employed" });
  const pension = evaluateSchemeEligibility("pension", { age: "60 or above" });

  assert.equal(financial.status, "possible");
  assert.match(financial.checks[0], /street-vending/i);
  assert.equal(pension.status, "possible");
  assert.match(pension.checks[0], /state\/UT/i);
});

test("every positive profile signal has a corresponding explanation", () => {
  const cases = [
    ["health", { age: "60 or above" }],
    ["housing", { householdIncome: "Below ₹1 lakh" }],
    ["farmers", { occupation: "Farmer" }],
    ["education", { socialCategory: "SC", householdIncome: "Below ₹1 lakh" }],
    ["women-child", { gender: "Woman" }],
    ["employment", { occupation: "Wage worker" }],
    ["pension", { age: "60 or above" }],
    ["financial", { occupation: "Self-employed" }],
  ];

  for (const [schemeId, profile] of cases) {
    const result = evaluateSchemeEligibility(schemeId, profile);
    assert.ok(result.relevanceScore > 0, `${schemeId} should have a positive profile signal`);
    assert.ok(result.relevanceReasons.length > 0, `${schemeId} should explain its profile signal`);
  }
});

test("status labels distinguish verified outcomes from provisional screening", () => {
  assert.equal(getEligibilityStatusLabel("eligible"), "Eligible");
  assert.equal(getEligibilityStatusLabel("not-eligible"), "Not eligible");
  assert.match(getEligibilityStatusLabel("possible"), /needs verification/i);
});
