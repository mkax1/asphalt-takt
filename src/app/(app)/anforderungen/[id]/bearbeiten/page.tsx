"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { AnforderungForm } from "@/components/anforderung-form";

export default function AnforderungBearbeitenPage() {
  const { id } = useParams<{ id: string }>();
  const { anforderungen, currentUser } = useStore();
  const a = anforderungen.find((x) => x.id === id);

  if (!a) {
    return (
      <p className="mx-auto max-w-4xl rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        Anforderung nicht gefunden.{" "}
        <Link href="/anforderungen" className="text-primary underline">
          Zur Liste
        </Link>
      </p>
    );
  }

  const darfBearbeiten =
    currentUser.rolle === "admin" ||
    (currentUser.id === a.erfasst_von && a.status === "neu_erfasst");

  if (!darfBearbeiten) {
    return (
      <p className="mx-auto max-w-4xl rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        Diese Anforderung kann nicht (mehr) bearbeitet werden. Sie ist entweder
        bereits in Prüfung oder gehört einer anderen Person.{" "}
        <Link
          href={`/anforderungen/${a.id}`}
          className="text-primary underline"
        >
          Zur Detailansicht
        </Link>
      </p>
    );
  }

  return <AnforderungForm initial={a} />;
}
