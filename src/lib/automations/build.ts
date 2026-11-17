import type { AutomationSpec } from "./catalog";

export type BuildStatus = "ready" | "pending" | "built";

/** Actions in the client's own accounts run through its Activepieces flow, which the office builds. */
export const needsBuild = (spec: AutomationSpec) => spec.actions.some((a) => a.type === "activepieces");

const signature = (spec: AutomationSpec) => JSON.stringify(spec.actions.filter((a) => a.type === "activepieces"));

/**
 * The build status after a save. A new or changed Activepieces part goes (back) to the office;
 * anything else keeps what it had. `notify` is true when the office should hear about it now.
 */
export function nextBuildStatus(spec: AutomationSpec, before?: { spec: AutomationSpec; build_status: BuildStatus } | null): { status: BuildStatus; notify: boolean } {
  if (!needsBuild(spec)) return { status: "ready", notify: false };
  if (before && before.build_status !== "ready" && signature(before.spec) === signature(spec)) return { status: before.build_status, notify: false };
  return { status: "pending", notify: true };
}
