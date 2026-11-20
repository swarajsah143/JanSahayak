import assert from "node:assert/strict";
import test from "node:test";
import { clampChatPosition, getChatPanelLayout } from "./chat-position.js";

test("launcher position is clamped inside the viewport", () => {
  assert.deepEqual(
    clampChatPosition(1200, 900, 200, 48, { width: 1280, height: 800 }),
    { left: 1072, top: 744, width: 200, height: 48 },
  );
});

test("chat panel opens above a launcher near the bottom and stays within the viewport", () => {
  const layout = getChatPanelLayout(
    { left: 1100, top: 740, width: 200, height: 48 },
    { width: 1280, height: 800, isMobile: false },
  );

  assert.equal(layout.side, "above");
  assert.equal(layout.bottom, 72);
  assert.equal(layout.left + layout.width <= 1272, true);
  assert.equal(layout.height, 590);
});

test("chat panel opens below a launcher near the top on a narrow screen", () => {
  const layout = getChatPanelLayout(
    { left: 8, top: 16, width: 200, height: 46 },
    { width: 390, height: 844, isMobile: true },
  );

  assert.equal(layout.side, "below");
  assert.equal(layout.left, 8);
  assert.equal(layout.top, 74);
  assert.equal(layout.width, 366);
  assert.equal(layout.height, 570);
});
