"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { ROLLE_LABEL } from "@/lib/status";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MaterialKategorie } from "@/lib/types";

const KAT_LABEL: Record<MaterialKategorie, string> = {
  tragschicht: "Tragschicht",
  binderschicht: "Binderschicht",
  deckschicht: "Deckschicht",
};

export default function AdminPage() {
  const {
    materialarten,
    kolonnen,
    benutzer,
    currentUser,
    addMaterialart,
    addKolonne,
  } = useStore();

  const [matOpen, setMatOpen] = useState(false);
  const [matForm, setMatForm] = useState({
    material_nr: "",
    bezeichnung: "",
    kategorie: "tragschicht" as MaterialKategorie,
  });

  const [kolOpen, setKolOpen] = useState(false);
  const [kolForm, setKolForm] = useState({ name: "", farbe: "#005A99" });

  if (currentUser.rolle !== "admin") {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Administration" />
        <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nur Administratoren haben Zugriff auf diesen Bereich. Wechsle die
          Rolle (links in der Seitenleiste) auf „Administrator", um die
          Stammdaten zu pflegen.
        </p>
      </div>
    );
  }

  function matSpeichern() {
    if (!matForm.material_nr || !matForm.bezeichnung) {
      toast.error("Material-Nr. und Bezeichnung sind Pflicht.");
      return;
    }
    addMaterialart({
      ...matForm,
      standard_lkw: 0,
      standard_taktung_min: 0,
    });
    toast.success("Material angelegt.");
    setMatForm({ material_nr: "", bezeichnung: "", kategorie: "tragschicht" });
    setMatOpen(false);
  }

  function kolSpeichern() {
    if (!kolForm.name) {
      toast.error("Name ist Pflicht.");
      return;
    }
    addKolonne({ ...kolForm, aktiv: true });
    toast.success("Kolonne angelegt.");
    setKolForm({ name: "", farbe: "#005A99" });
    setKolOpen(false);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Administration"
        description="Stammdaten pflegen: Material, Kolonnen und Benutzer."
      />

      <Tabs defaultValue="material">
        <TabsList>
          <TabsTrigger value="material">Materialarten</TabsTrigger>
          <TabsTrigger value="kolonnen">Kolonnen</TabsTrigger>
          <TabsTrigger value="benutzer">Benutzer</TabsTrigger>
        </TabsList>

        <TabsContent value="material" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button onClick={() => setMatOpen(true)}>
              <Plus className="size-4" />
              Neues Material
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nr.</TableHead>
                    <TableHead>Bezeichnung</TableHead>
                    <TableHead>Kategorie</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materialarten.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        {m.material_nr}
                      </TableCell>
                      <TableCell>{m.bezeichnung}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {KAT_LABEL[m.kategorie]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kolonnen" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button onClick={() => setKolOpen(true)}>
              <Plus className="size-4" />
              Neue Kolonne
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Farbe</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kolonnen.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell>
                        <span
                          className="inline-block size-4 rounded-full"
                          style={{ backgroundColor: k.farbe }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{k.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-emerald-200 bg-emerald-50 text-emerald-700"
                        >
                          {k.aktiv ? "aktiv" : "inaktiv"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="benutzer" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>E-Mail</TableHead>
                    <TableHead>Rolle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {benutzer.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{ROLLE_LABEL[u.rolle]}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Material */}
      <Dialog open={matOpen} onOpenChange={setMatOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neues Material</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Material-Nr. *</Label>
              <Input
                value={matForm.material_nr}
                onChange={(e) =>
                  setMatForm({ ...matForm, material_nr: e.target.value })
                }
                placeholder="z. B. 101"
              />
            </div>
            <div className="space-y-2">
              <Label>Bezeichnung *</Label>
              <Input
                value={matForm.bezeichnung}
                onChange={(e) =>
                  setMatForm({ ...matForm, bezeichnung: e.target.value })
                }
                placeholder="z. B. AC 32 TS 50/70"
              />
            </div>
            <div className="space-y-2">
              <Label>Kategorie</Label>
              <Select
                value={matForm.kategorie}
                onValueChange={(v) =>
                  setMatForm({ ...matForm, kategorie: v as MaterialKategorie })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tragschicht">Tragschicht</SelectItem>
                  <SelectItem value="binderschicht">Binderschicht</SelectItem>
                  <SelectItem value="deckschicht">Deckschicht</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMatOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={matSpeichern}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Kolonne */}
      <Dialog open={kolOpen} onOpenChange={setKolOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Kolonne</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={kolForm.name}
                onChange={(e) =>
                  setKolForm({ ...kolForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={kolForm.farbe}
                  onChange={(e) =>
                    setKolForm({ ...kolForm, farbe: e.target.value })
                  }
                  className="h-9 w-16 cursor-pointer rounded border"
                />
                <Input
                  value={kolForm.farbe}
                  onChange={(e) =>
                    setKolForm({ ...kolForm, farbe: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKolOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={kolSpeichern}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
