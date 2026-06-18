"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { ROLLE_LABEL } from "@/lib/status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function LoginPage() {
  const router = useRouter();
  const { benutzer, currentUser, setCurrentUserId } = useStore();
  const [userId, setUserId] = useState(currentUser.id);

  const selected = benutzer.find((b) => b.id === userId) ?? benutzer[0];

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setCurrentUserId(userId);
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/30 p-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src="/logo.png"
            alt="Josef Hebel"
            width={72}
            height={72}
            priority
            className="size-18 rounded-xl shadow-md"
          />
          <div className="mt-3 h-1 w-12 rounded-full bg-hebel-gelb" />
          <h1 className="mt-3 text-2xl font-semibold">Asphalt-Takt</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mischgut-Disposition für den Straßenbau
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={selected.email}
              readOnly
              className="bg-muted/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw">Kennwort</Label>
            <Input id="pw" type="password" defaultValue="demo" />
          </div>
          <div className="space-y-2">
            <Label>Rolle (Demo-Auswahl)</Label>
            <Select
              value={userId}
              onValueChange={(v) => v && setUserId(v)}
              items={Object.fromEntries(
                benutzer.map((b) => [b.id, `${b.name} · ${ROLLE_LABEL[b.rolle]}`])
              )}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {benutzer.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} · {ROLLE_LABEL[b.rolle]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full">
            Anmelden
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Demo-Modus – Daten werden lokal im Browser gespeichert.
        </p>
      </Card>
    </div>
  );
}
