import { NextResponse } from "next/server";

interface Punkt {
  lat: number;
  lng: number;
}

/**
 * Serverseitige Routenberechnung mit OpenRouteService.
 * Der API-Key wird ausschließlich serverseitig aus ORS_API_KEY gelesen und
 * niemals an das Frontend ausgeliefert.
 */
export async function POST(req: Request) {
  const key = process.env.ORS_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Kein API-Key hinterlegt (ORS_API_KEY in .env.local)." },
      { status: 500 }
    );
  }

  let body: { from?: Punkt; to?: Punkt };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const { from, to } = body;
  if (
    !from ||
    !to ||
    typeof from.lat !== "number" ||
    typeof from.lng !== "number" ||
    typeof to.lat !== "number" ||
    typeof to.lng !== "number"
  ) {
    return NextResponse.json(
      { error: "Start- oder Zielkoordinaten fehlen." },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      "https://api.openrouteservice.org/v2/directions/driving-hgv",
      {
        method: "POST",
        headers: {
          Authorization: key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coordinates: [
            [from.lng, from.lat],
            [to.lng, to.lat],
          ],
        }),
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Route konnte nicht berechnet werden." },
        { status: 502 }
      );
    }

    const data = await res.json();
    const summary = data?.routes?.[0]?.summary;
    if (!summary || typeof summary.distance !== "number") {
      return NextResponse.json(
        { error: "Keine Route gefunden." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      distanzKm: summary.distance / 1000,
      fahrzeitMin: summary.duration / 60,
    });
  } catch {
    return NextResponse.json(
      { error: "Routendienst nicht erreichbar." },
      { status: 502 }
    );
  }
}
