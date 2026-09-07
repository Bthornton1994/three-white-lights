/**
 * Metro bundles a `.jpg` the same way it bundles a `.wav`: the import resolves
 * to an opaque asset id. TypeScript needs telling. These are the Iron & Amber
 * training plates under `assets/iron-amber/`.
 */
declare module '*.jpg' {
  const assetId: number;
  export default assetId;
}
