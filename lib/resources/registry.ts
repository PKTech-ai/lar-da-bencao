import { patrimonyAssets } from "@/lib/resources/defs/patrimonio";
import type { ResourceDef } from "@/lib/resources/types";

const ALL: ResourceDef[] = [patrimonyAssets];

export const RESOURCES: Record<string, ResourceDef> = Object.fromEntries(ALL.map((def) => [def.key, def]));
export const RESOURCE_LIST = ALL;
