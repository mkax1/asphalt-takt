"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MapPin, MoreVertical, Pencil, Plus, Power, Search } from "lucide-react";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
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

  const [suche, setSuche] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Baustelle, "id">>(leer);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    if (!q) return baustellen;
    return baustellen.filter((b) =>
      [b.name, b.baustellennummer, b.adresse, b.ansprechpartner, b.ordner_nr]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(q))
    );
  }, [baustellen, suche]);

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

  function statusUmschalten(b: Baustelle) {
    const neuerStatus = b.status === "aktiv" ? "inaktiv" : "aktiv";
    updateBaustelle(b.id, { status: neuerStatus });
    toast.success(
      neuerStatus === "aktiv" ? "Baustelle aktiviert." : "Baustelle deaktiviert."
    );
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

      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Name, Nummer, Ort oder Ansprechpartner suchen…"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[9%]">Ordner</TableHead>
                <TableHead className="w-[13%]">Nummer</TableHead>
                <TableHead className="w-[25%]">Name</TableHead>
                <TableHead className="w-[21%]">Ort / Adresse</TableHead>
                <TableHead className="w-[14%]">Ansprechpartner</TableHead>
                <TableHead className="w-[10%]">Status</TableHead>
                {darfBearbeiten && (
                  <TableHead className="w-[8%] text-right">Aktion</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {gefiltert.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={darfBearbeiten ? 7 : 6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Keine Baustellen gefunden.
                  </TableCell>
                </TableRow>
              )}
              {gefiltert.map((b) => (
                <TableRow
                  key={b.id}
                  className={cn(b.status === "inaktiv" && "opacity-55")}
                >
                  <TableCell
                    className="truncate text-muted-foreground"
                    title={b.ordner_nr}
                  >
                    {b.ordner_nr || "–"}
                  </TableCell>
                  <TableCell className="truncate" title={b.baustellennummer}>
                    {b.baustellennummer}
                  </TableCell>
                  <TableCell className="truncate font-medium" title={b.name}>
                    {b.name}
                  </TableCell>
                  <TableCell className="truncate" title={b.adresse}>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{b.adresse}</span>
                    </span>
                  </TableCell>
                  <TableCell
                    className="truncate"
                    title={b.ansprechpartner}
                  >
                    {b.ansprechpartner || "–"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        b.status === "aktiv"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-100 text-slate-500"
                      }
                    >
                      {b.status === "aktiv" ? "Aktiv" : "Inaktiv"}
                    </Badge>
                  </TableCell>
                  {darfBearbeiten && (
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                          <MoreVertical className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => bearbeiten(b)}>
                            <Pencil className="size-4" />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => statusUmschalten(b)}>
                            <Power className="size-4" />
                            {b.status === "aktiv"
                              ? "Deaktivieren"
                              : "Aktivieren"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm({ ...form, status: v as Baustelle["status"] })
                }
                items={{ aktiv: "Aktiv", inaktiv: "Inaktiv" }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aktiv">Aktiv</SelectItem>
                  <SelectItem value="inaktiv">Inaktiv</SelectItem>
                </SelectContent>
              </Select>
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
