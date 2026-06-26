// Single source of truth for the app's user-facing version string. Bump in
// tandem with package.json when shipping a release.
//
// (We don't import package.json directly because tsconfig's resolveJsonModule
// flag can vary across build environments and Next.js prefers explicit
// constants for client-bundled values.)
export const APP_VERSION = "0.6.0";

export { CHANGELOG } from "@/lib/changelog";
