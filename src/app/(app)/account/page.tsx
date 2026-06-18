"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Moon, RotateCcw, Sun } from "lucide-react";
import { useStore } from "@/lib/store";
import { ROLLE_LABEL } from "@/lib/status";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AccountPage() {
  const { currentUser, resetDaten } = useStore();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const gespeichert = localStorage.getItem("asphalt-takt-theme") === "dark";
    setDark(gespeichert);
    document.documentElement.classList.toggle("dark", gespeichert);
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("asphalt-takt-theme", next ? "dark" : "light");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Mein Account" description="Einstellungen und Profil." />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profil</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={currentUser.name} readOnly className="bg-muted/40" />
            </div>
            <div className="space-y-2">
              <Label>E-Mail</Label>
              <Input value={currentUser.email} readOnly className="bg-muted/40" />
            </div>
            <div className="space-y-2">
              <Label>Rolle</Label>
              <Input
                value={ROLLE_LABEL[currentUser.rolle]}
                readOnly
                className="bg-muted/40"
              />
            </div>
            <div className="space-y-2">
              <Label>Firma</Label>
              <Input
                value={currentUser.firma ?? ""}
                readOnly
                className="bg-muted/40"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kennwort ändern</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Neues Kennwort</Label>
              <Input type="password" placeholder="••••••••" />
            </div>
            <div className="space-y-2">
              <Label>Kennwort wiederholen</Label>
              <Input type="password" placeholder="••••••••" />
            </div>
            <Button onClick={() => toast.success("Kennwort gespeichert (Demo).")}>
              Speichern
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Darstellung</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {dark ? "Dunkles" : "Helles"} Design
            </div>
            <Button variant="outline" onClick={toggleDark}>
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              {dark ? "Hell" : "Dunkel"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Demo-Daten</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Alle Beispieldaten auf den Ausgangszustand zurücksetzen.
            </div>
            <Button
              variant="outline"
              onClick={() => {
                resetDaten();
                toast.success("Demo-Daten zurückgesetzt.");
              }}
            >
              <RotateCcw className="size-4" />
              Zurücksetzen
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
