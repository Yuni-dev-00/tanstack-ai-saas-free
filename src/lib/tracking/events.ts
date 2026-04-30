// Single source of truth for analytics event names. Adding/renaming an
// event MUST update this union — every emit site (client `track()` +
// server `serverTrack()`) is typed against EventName so a typo or stale
// name fails compilation rather than silently drops to /dev/null in
// Plausible.
//
// Naming convention: snake_case, verb_object form. The Plausible UI
// alphabetises events, so prefixing related events with the same noun
// (`ai_*`, `signup_*`) keeps them grouped.

export type EventName =
  // Auth funnel
  | "signup_started" // user opened the email-signup tab in the auth dialog
  | "signup_completed" // server-side: user record was just created
  | "signin_completed" // server-side: existing user established a session

  // Product engagement
  | "ai_generate_clicked" // client: submit button clicked
  | "ai_job_submitted" // server: createJobInTx returned + provider call dispatched
  | "ai_job_succeeded" // server: webhook applied terminal succeeded state
  | "ai_job_failed" // server: webhook applied terminal failed state OR reconciler dead-lettered
  | "download_clicked"; // client: user downloaded a generated asset

// Loose props bag — Plausible accepts string-only props (max 30 per
// event), but we let TS authors pass numbers/booleans and stringify in
// the helpers.
export type EventProps = Record<string, string | number | boolean | null | undefined>;

export interface RevenueProps {
  currency: string;
  amount: number;
}
