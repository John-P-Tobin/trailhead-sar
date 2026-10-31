import "server-only";
import { createHmac } from "node:crypto";
import { PublishFeature } from "../caltopoPublish";

// CalTopo signed-request client (same scheme as caltopo_python). Credentials come
// from env on the server only and are never sent to the browser or logged.

export interface CalTopoConfig {
  id: string;
  key: string;
  mapId: string;
  host: string;
}

export function readConfig(env: Record<string, string | undefined> = process.env): CalTopoConfig | null {
  const id = env.CALTOPO_ID?.trim();
  const key = env.CALTOPO_KEY?.trim();
  const mapId = env.CALTOPO_MAP_ID?.trim();
  if (!id || !key || !mapId) return null;
  return { id, key, mapId, host: env.CALTOPO_HOST?.trim() || "caltopo.com" };
}

export const mapUrl = (c: CalTopoConfig) => `https://${c.host}/m/${c.mapId}`;

/** base64(HMAC-SHA256(base64decode(key), "METHOD path\nexpires\npayload")). */
export function signRequest(key: string, method: string, path: string, expires: number, payload: string): string {
  const data = `${method.toUpperCase()} ${path}\n${expires}\n${payload}`;
  return createHmac("sha256", Buffer.from(key, "base64")).update(data).digest("base64");
}

async function send(c: CalTopoConfig, method: "POST" | "DELETE", path: string, payload: unknown): Promise<{ id?: string }> {
  const expires = Date.now() + 120_000;
  const json = method === "POST" ? JSON.stringify(payload) : "";
  const params = new URLSearchParams({ id: c.id, expires: String(expires), signature: signRequest(c.key, method, path, expires, json), json });
  const url = `https://${c.host}${path}${method === "DELETE" ? `?${params}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: { "User-Agent": "TrailheadSAR (hackathon demo)", ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: method === "POST" ? params : undefined,
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`CalTopo ${res.status}`);
  const body = (await res.json().catch(() => ({}))) as { status?: string; result?: { id?: string }; message?: string };
  if (body.status && body.status !== "ok") throw new Error(`CalTopo: ${body.message ?? body.status}`);
  return { id: body.result?.id };
}

export async function createFolder(c: CalTopoConfig, title: string): Promise<string> {
  const r = await send(c, "POST", `/api/v1/map/${c.mapId}/Folder`, { properties: { title, visible: true, labelVisible: true } });
  if (!r.id) throw new Error("CalTopo did not return a folder id");
  return r.id;
}

export function toCalTopoObject(f: PublishFeature, folderId: string): unknown {
  if (f.class === "Marker") {
    return {
      type: "Feature",
      properties: {
        class: "Marker",
        title: f.title,
        description: f.description,
        folderId,
        "marker-color": f.style["marker-color"] ?? "#94a3b8",
        "marker-symbol": f.style["marker-symbol"] ?? "point",
        "marker-size": 1,
        "marker-visibility": "visible",
      },
      geometry: f.geometry,
    };
  }
  return { properties: { title: f.title, description: f.description, folderId, ...f.style }, geometry: f.geometry };
}

export async function createFeature(c: CalTopoConfig, f: PublishFeature, folderId: string): Promise<string> {
  const r = await send(c, "POST", `/api/v1/map/${c.mapId}/${f.class}`, toCalTopoObject(f, folderId));
  if (!r.id) throw new Error(`CalTopo did not return an id for ${f.class}`);
  return r.id;
}

export async function deleteFeature(c: CalTopoConfig, id: string, cls: "Marker" | "Shape" | "Folder"): Promise<void> {
  await send(c, "DELETE", `/api/v1/map/${c.mapId}/${cls}/${id}`, null);
}
