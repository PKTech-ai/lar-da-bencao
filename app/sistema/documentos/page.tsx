import { requireModulePage } from "@/lib/page-auth";
import { query } from "@/lib/db";

export default async function DocumentosPage() {
  await requireModulePage("module_documentos", { resource: "institucional" });
  const documents = await query<{ id: string; slug: string; title: string; attachment_id: string | null }>(
    "select id, slug, title, attachment_id from app.institutional_documents where published order by title"
  );
  return (
    <>
      <header className="page-heading">
        <div><h1>Estatuto e Regimento</h1><p>Documentos institucionais com acesso autenticado.</p></div>
      </header>
      <section className="card">
        {documents.rows.length === 0 ? (
          <p className="muted">Nenhum documento publicado ainda. Um administrador pode cadastrar metadados via API `/api/documents` e vincular anexos.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Documento</th><th>Identificador</th><th>Anexo</th></tr></thead>
              <tbody>
                {documents.rows.map((doc) => (
                  <tr key={doc.id}>
                    <td><strong>{doc.title}</strong></td>
                    <td>{doc.slug}</td>
                    <td>{doc.attachment_id ? <a className="button" href={`/api/attachments/${doc.attachment_id}/download`}>Baixar</a> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
