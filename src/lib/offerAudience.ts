import type { OfferAudience } from "../types";

export type { OfferAudience } from "../types";

export const audienceUsesFleet = (audience: OfferAudience): boolean =>
  audience === "own_fleet" || audience === "own_fleet_and_affiliates";

export const audienceUsesAffiliates = (audience: OfferAudience): boolean =>
  audience === "affiliates" || audience === "own_fleet_and_affiliates";
