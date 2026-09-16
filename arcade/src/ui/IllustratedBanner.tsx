import { ILLUSTRATED_EDITION } from "../illustrated/edition.ts";

export function IllustratedBanner() {
  return (
    <p className="illustrated-banner" role="note">
      {ILLUSTRATED_EDITION.BANNER}
    </p>
  );
}
