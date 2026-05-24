"use client";

import { useState } from "react";
import { PreviewPane } from "./preview-pane";
import { FollowUpChat } from "./follow-up-chat";
import { ScaffoldPanel } from "./scaffold-panel";
import type { Club } from "@/lib/data";

export function FixturePane({
  slug,
  home,
  away,
}: {
  slug: string;
  home: Club;
  away: Club;
}) {
  const [previewText, setPreviewText] = useState<string>("");
  return (
    <>
      <PreviewPane
        slug={slug}
        home={home}
        away={away}
        onComplete={setPreviewText}
      />
      {previewText && <FollowUpChat slug={slug} previewText={previewText} />}
      <ScaffoldPanel />
    </>
  );
}
