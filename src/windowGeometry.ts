export type WindowPlacement = {
  x: number; y: number; width: number; height: number;
  mode: "normal" | "maximized" | "left" | "right" | "fullscreen";
};
export type Workspace = { width: number; height: number };

export const canSplitWindows = ({ width, height }: Workspace) => width >= 672 && height >= 260;

/** Keep stored window positions usable after rotation, zoom, and workspace resizing. */
export function fitWindow(window: WindowPlacement, workspace: Workspace, mobile: boolean, fullScreen = mobile, minimumHeight = 260) {
  const availableWidth = Math.max(1, workspace.width);
  const availableHeight = Math.max(1, workspace.height);
  if (fullScreen || (mobile && window.mode !== "normal")) {
    return { x: 0, y: 0, width: availableWidth, height: availableHeight };
  }
  const gutter = Math.min(8, availableWidth / 4, availableHeight / 4);
  const maxWidth = availableWidth - gutter * 2;
  const maxHeight = availableHeight - gutter * 2;
  if (window.mode !== "normal") {
    if ((window.mode === "left" || window.mode === "right") && canSplitWindows(workspace)) {
      const width = (maxWidth - gutter) / 2;
      return { x: window.mode === "right" ? gutter * 2 + width : gutter, y: gutter, width, height: maxHeight };
    }
    return { x: gutter, y: gutter, width: maxWidth, height: maxHeight };
  }
  const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
  const width = Math.min(maxWidth, Math.max(mobile ? 280 : 320, finite(window.width, 760)));
  const height = Math.min(maxHeight, Math.max(minimumHeight, finite(window.height, 510)));
  return {
    x: Math.max(gutter, Math.min(finite(window.x, gutter), availableWidth - width - gutter)),
    y: Math.max(gutter, Math.min(finite(window.y, gutter), availableHeight - height - gutter)),
    width, height,
  };
}
