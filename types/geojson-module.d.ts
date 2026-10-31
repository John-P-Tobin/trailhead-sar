// data/terrain.geojson is imported as JSON (see the turbopack rule in next.config.ts).
declare module "*.geojson" {
  const value: unknown;
  export default value;
}
