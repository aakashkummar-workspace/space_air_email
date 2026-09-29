import { redirect } from "next/navigation";

// Dashboard temporarily disabled — the full page is preserved at
// .disabled-pages/dashboard-page.tsx (project root). To restore: replace
// this file's contents with that file's, and add the Dashboard entry back
// to NAV in AppShell.tsx.
export default function Home() {
  redirect("/projects");
}
