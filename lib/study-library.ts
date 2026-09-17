import type { Actor } from "@/lib/auth";
import { z } from "zod";
import { requireFlag, flagForDepartment } from "@/lib/feature-flags";
import { assertPermission, hasPermission } from "@/lib/permissions";

export const libraryDepartment = z.enum(["doutrina", "infancia", "juventude"]);
export type LibraryDepartment = z.infer<typeof libraryDepartment>;
export const STUDY_TYPES = ["ESE", "ESDE", "MEP", "OBRA", "PALESTRA", "TREINAMENTO", "OUTRO"] as const;

export async function requireLibrary(actor: Actor, department: LibraryDepartment, action: "read" | "create" | "update" | "delete") {
  await requireFlag(flagForDepartment(department));
  await assertPermission(actor, "department", action, department);
}

export async function canEditLibrary(actor: Actor, department: LibraryDepartment) {
  return hasPermission(actor, "department", "update", department);
}

export const attachmentOwnerType = (department: LibraryDepartment) => `study_material_${department}`;

export const studyInput = z.object({
  folder_id: z.string().uuid().nullable().optional(),
  study_type: z.enum(STUDY_TYPES).nullable().optional(),
  code: z.string().trim().max(40).optional().default(""),
  title: z.string().trim().min(1).max(200),
  reference: z.string().trim().max(300).optional().default(""),
  description: z.string().trim().max(4000).optional().default("")
});
