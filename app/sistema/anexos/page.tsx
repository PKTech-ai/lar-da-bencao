import { redirect } from "next/navigation";
import { AttachmentAdmin } from "./attachment-admin";
import { AttachmentManager } from "./attachment-manager";
import { requirePageActor } from "@/lib/page-auth";
import { hasPermission } from "@/lib/permissions";

export default async function AttachmentsPage() {
  const actor = await requirePageActor();
  if (!(await hasPermission(actor, "attachments", "admin"))) redirect("/sistema");
  return (
    <>
      <header className="page-heading"><div><h1>Anexos no PostgreSQL</h1><p>Volume, quarentena e teste operacional de upload fracionado, inspeção e download autorizado.</p></div><span className="production-badge">BYTEA · privado</span></header>
      <AttachmentAdmin />
      <div style={{ marginTop: 16 }}><AttachmentManager /></div>
    </>
  );
}
