const EDGE_MARGIN = 8;
const PANEL_GAP = 12;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function clampChatPosition(left, top, width, height, viewport) {
  return {
    left: clamp(left, EDGE_MARGIN, viewport.width - width - EDGE_MARGIN),
    top: clamp(top, EDGE_MARGIN, viewport.height - height - EDGE_MARGIN),
    width,
    height,
  };
}

export function getChatPanelLayout(position, viewport) {
  const horizontalPadding = viewport.isMobile ? 24 : 32;
  const panelWidth = Math.max(0, Math.min(390, viewport.width - horizontalPadding));
  const left = clamp(
    position.left + (position.width - panelWidth) / 2,
    EDGE_MARGIN,
    viewport.width - panelWidth - EDGE_MARGIN,
  );
  const maxHeight = Math.max(
    0,
    Math.min(
      viewport.isMobile ? 570 : 590,
      viewport.height - (viewport.isMobile ? 88 : 105),
    ),
  );
  const spaceAbove = Math.max(0, position.top - PANEL_GAP - EDGE_MARGIN);
  const spaceBelow = Math.max(
    0,
    viewport.height - position.top - position.height - PANEL_GAP - EDGE_MARGIN,
  );
  const side = spaceAbove >= spaceBelow ? "above" : "below";
  const height = Math.min(maxHeight, side === "above" ? spaceAbove : spaceBelow);

  return {
    left,
    width: panelWidth,
    height,
    minHeight: Math.min(360, height),
    side,
    top: side === "below" ? position.top + position.height + PANEL_GAP : null,
    bottom: side === "above" ? viewport.height - position.top + PANEL_GAP : null,
  };
}
