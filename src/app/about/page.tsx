import type { Metadata } from "next";
import AboutClient from "@/components/about/AboutClient";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return <AboutClient />;
}
