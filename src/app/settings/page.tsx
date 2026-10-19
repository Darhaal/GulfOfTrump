import { Suspense } from "react";
import SettingsClient from "@/components/settings/SettingsClient";

export default function SettingsPage() {
  // useSearchParams needs a Suspense boundary for static rendering.
  return (
    <Suspense>
      <SettingsClient />
    </Suspense>
  );
}
