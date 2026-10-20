import type { Metadata } from "next";
import PrivacyClient from "@/components/about/PrivacyClient";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return <PrivacyClient />;
}
