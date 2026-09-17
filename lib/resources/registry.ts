import {
  basketSupporters, brechoLedger, childrenCoffeeDonors, clubDeliveries, clubPeople, clubeMaesLedger,
  hygieneKits, ranchoDeliveries, socialActivities, socialFamilies, socialVolunteers
} from "@/lib/resources/defs/assistencia";
import { bookLoans, bookSales, bookStock, books } from "@/lib/resources/defs/divulgacao";
import { events, eventItems, eventReviews, eventShifts } from "@/lib/resources/defs/eventos";
import { patrimonyAssets } from "@/lib/resources/defs/patrimonio";
import { meetings } from "@/lib/resources/defs/secretaria";
import type { ResourceDef } from "@/lib/resources/types";

const ALL: ResourceDef[] = [
  patrimonyAssets,
  events, eventItems, eventShifts, eventReviews,
  books, bookStock, bookLoans, bookSales,
  meetings,
  socialFamilies, socialVolunteers, basketSupporters, ranchoDeliveries, hygieneKits, socialActivities, childrenCoffeeDonors,
  brechoLedger, clubeMaesLedger, clubPeople, clubDeliveries
];

export const RESOURCES: Record<string, ResourceDef> = Object.fromEntries(ALL.map((def) => [def.key, def]));
export const RESOURCE_LIST = ALL;
