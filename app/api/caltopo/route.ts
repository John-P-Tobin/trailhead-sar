import { z } from "zod";
import { createFeature, createFolder, deleteFeature, mapUrl, readConfig } from "@/lib/server/caltopo";
import { MAX_PUBLISH_FEATURES, PUBLISH_FOLDER_PREFIX } from "@/lib/caltopoPublish";

// Live publishing of app-owned features to the team's CalTopo map.
// Safety: Trailhead only ever creates features inside its own "[Trailhead]" folder
// and only deletes ids it created earlier (sent back by the client). Human-drawn
// features are never touched. CalTopo has no undo, so new features are written
// first and the previous set is removed afterwards.
export const maxDuration = 60;

const Owned = z.object({ id: z.string().min(1).max(64), class: z.enum(["Marker", "Shape", "Folder"]) });
const Feature = z.object({
  class: z.enum(["Marker", "Shape"]),
  title: z.string().max(200),
  description: z.string().max(4000),
  geometry: z.union([
    z.object({ type: z.literal("Point"), coordinates: z.tuple([z.number(), z.number()]) }),
    z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(z.tuple([z.number(), z.number()])).min(4)).min(1) }),
  ]),
  style: z.record(z.string(), z.union([z.string(), z.number()])),
});
const Body = z.object({
  features: z.array(Feature).min(1).max(MAX_PUBLISH_FEATURES),
  previous: z.array(Owned).max(200).default([]),
  label: z.string().max(80).default(""),
});

export async function GET() {
  const c = readConfig();
  return Response.json(c ? { configured: true, mapUrl: mapUrl(c), mapId: c.mapId } : { configured: false });
}

export async function POST(req: Request) {
  const c = readConfig();
  if (!c) return Response.json({ ok: false, reason: "CalTopo publishing is not configured on the server." }, { status: 503 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ ok: false, reason: "Invalid publish request." }, { status: 400 });

  const stamp = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" });
  const created: { id: string; class: "Marker" | "Shape" | "Folder" }[] = [];
  try {
    const folderId = await createFolder(c, `${PUBLISH_FOLDER_PREFIX} ${body.data.label || "Search"} · ${stamp} ET`);
    created.push({ id: folderId, class: "Folder" });
    for (const f of body.data.features) {
      const id = await createFeature(c, f, folderId);
      created.push({ id, class: f.class });
    }
  } catch (e) {
    return Response.json({ ok: false, reason: `Publish failed: ${(e as Error).message}. ${created.length} feature(s) were written before the failure.`, created }, { status: 502 });
  }

  // Remove the previous app-owned set (features first, their folder last). Failures here are reported, not fatal.
  let deleted = 0;
  const leftovers: { id: string; class: "Marker" | "Shape" | "Folder" }[] = [];
  const prev = [...body.data.previous].sort((a, b) => (a.class === "Folder" ? 1 : 0) - (b.class === "Folder" ? 1 : 0));
  for (const p of prev) {
    try {
      await deleteFeature(c, p.id, p.class);
      deleted++;
    } catch {
      leftovers.push(p);
    }
  }
  return Response.json({ ok: true, created, deleted, leftovers, mapUrl: mapUrl(c) });
}
