"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ui } from "@/components/ui/classes";
import { useI18n } from "@/i18n/useI18n";
import { startTutorial } from "@/lib/tutorial";

/** The whole window while the tutorial game is being set up: the emblem of a lesson and a spinner, or what went wrong. */
export function TutorialPreparing({ failed = false }: { failed?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-page px-4" role="status" aria-live="polite">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-accent">
          <GraduationCap className="h-7 w-7" />
        </span>
        <div className="text-lg font-black tracking-tight text-ink">{t(failed ? "tutorial.failed" : "tutorial.preparing")}</div>
        {failed ? (
          <Link href="/" className={`${ui.primary} px-5 py-2.5 text-sm`}>
            {t("nav.home")}
          </Link>
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-muted" />
        )}
      </div>
    </div>
  );
}

/** `/new/2022/tutorial`: a new tutorial game at once, played as Ukraine, no country to pick. */
export default function TutorialStart() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    startTutorial().then(
      (id) => alive && router.replace(`/play/${id}`),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [router]);
  return <TutorialPreparing failed={failed} />;
}
