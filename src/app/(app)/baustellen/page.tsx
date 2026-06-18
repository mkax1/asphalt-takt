"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Pencil, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Baustelle } from "@/lib/types";

const leer: Omit<Baustelle, "id"> = {
  ordner_nr: "",
  baustellennummer: "",
  name: "",
  adresse: "",
  ansprechpartner: "",
  hinweis: "",
  status: "aktiv",
};

export default function BaustellenPage() {
  const { baustellen, currentUser, addBaustelle, updateBaustelle } = useStore();
  const darfBearbeiten = currentUser.rolle === "admin";

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Baustelle, "id">>(leer);

  function neu() {
    setEditId(null);
    setForm(leer);
    setOpen(true);
  }

  function bearbeiten(b: Baustelle) {
    setEditId(b.id);
    const { id: _id, ...rest } = b;
    void _id;
    setForm(rest);
    setOpen(true);
  }

  function speichern() {
    if (!form.name || !form.baustellennummer || !form.adresse) {
      toast.error("Name, Nummer und Adresse sind Pflicht.");
      return;
    }
    if (editId) {
      updateBaustelle(editId, form);
      toast.success("Baustelle aktualisiert.");
    } else {
      addBaustelle(form);
      toast.success("Baustelle angelegt.");
    }
    setOpen(false);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Baustellen"
        description="Stammdaten der Baustellen."
        actions={
          darfBearbeiten ? (
            <Button onClick={neu}>
              <Plus className="size-4" />
              Neue Baustelle
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ordner-Nr.</TableHead>
                <TableHead>Nummer</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Ort / Adresse</TableHead>
                <TableHead>Ansprechpartner</TableHead>
                <TableHead>Status</TableHead>
                {darfBearbeiten && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {baustellen.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="text-muted-foreground">
                    {b.ordner_nr || "–"}
                  </TableCell>
                  <TableCell>{b.baustellennummer}</TableCell>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-muted-foreground" />
                      {b.adresse}
                    </span>
                  </TableCell>
                  <TableCell>{b.ansprechpartner || "–"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        b.status === "aktiv"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                      }
                    >
                      {b.status}
                    </Badge>
                  </TableCell>
                  {darfBearbeiten && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => bearbeiten(b)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Baustelle bearbeiten" : "Neue Baustelle"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Ordner-Nr.</Label>
              <Input
                value={form.ordner_nr}
                onChange={(e) => setForm({ ...form, ordner_nr: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Baustellennummer *</Label>
              <Input
                value={form.baustellennummer}
                onChange={(e) =>
                  setForm({ ...form, baustellennummer: e.target.value })
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Ort / Adresse *</Label>
              <Input
                value={form.adresse}
                onChange={(e) => setForm({ ...form, adresse: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Ansprechpartner</Label>
              <Input
                value={form.ansprechpartner}
                onChange={(e) =>
                  setForm({ ...form, ansprechpartner: e.target.value })
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Baustellenhinweis</Label>
              <Textarea
                value={form.hinweis}
                onChange={(e) => setForm({ ...form, hinweis: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={speichern}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
