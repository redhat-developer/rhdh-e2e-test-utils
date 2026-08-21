/**
 * Sidebar entries a suite can open.
 *
 * The label depends on which shell is running. The legacy RHDH shell titles the
 * scaffolder entry point "Self-service"; under the new frontend system the same
 * page is "Create", and `packages/app-next` ships no global header at all. The
 * union carries both so a spec running in either shell type-checks without a cast
 * — it does not decide which one a given lane should use, which is
 * [RHIDP-16462](https://redhat.atlassian.net/browse/RHIDP-16462).
 */
export type SidebarTabs =
  | "Catalog"
  | "Settings"
  | "My Group"
  | "Home"
  // Legacy shell label for the scaffolder; "Create" is the app-next label.
  | "Self-service"
  | "Create"
  | "Learning Paths"
  | "Extensions"
  | "Bulk import"
  | "Docs"
  | "Clusters"
  | "Tech Radar"
  | "Notifications"
  | "Orchestrator";
