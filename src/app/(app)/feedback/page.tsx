"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export default function FeedbackPage() {
  const [text, setText] = useState("");

  function senden() {
    if (!text.trim()) {
      toast.error("Bitte gib zuerst dein Feedback ein.");
      return;
    }
    toast.success("Danke für dein Feedback!");
    setText("");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Feedback"
        description="Wünsche, Ideen oder Fehler melden."
      />
      <Card>
        <CardContent className="space-y-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Dein Feedback…"
          />
          <div className="flex justify-end">
            <Button onClick={senden}>
              <Send className="size-4" />
              Absenden
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
