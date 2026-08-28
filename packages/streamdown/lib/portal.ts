import type { PortalTarget } from "./streamdown-context";

export const resolvePortalTarget = (
  portal: PortalTarget | undefined
): HTMLElement => {
  const container = typeof portal === "function" ? portal() : portal;
  return container ?? document.body;
};
