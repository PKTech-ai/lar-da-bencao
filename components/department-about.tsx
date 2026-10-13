import type { DepartmentInfo } from "@/lib/department-info";

/** "Sobre o departamento — …": quadro recolhível do Painel (op-department do visual v215). */
export function DepartmentAbout({ info, coordinators }: { info: DepartmentInfo; coordinators: string[] }) {
  return (
    <details className="op-department">
      <summary>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
        <span>Sobre o departamento — {info.title}<small>Coordenação, atividades e orientações institucionais</small></span>
      </summary>
      <div className="dept-board">
        <div className="dept-board-head">
          <h3>Quadro do Departamento — {info.title}</h3>
          <p>{info.purpose}</p>
          {info.basis ? <p className="small"><strong>Base normativa:</strong> {info.basis}</p> : null}
        </div>
        <div className="dept-board-grid">
          <section className="dept-board-card">
            <h4>Quem coordena</h4>
            <p>{coordinators.length ? coordinators.join(" / ") : "Sem coordenador vinculado"}</p>
            <p className="small muted">Preenchimento automático conforme o perfil e o departamento dos usuários ativos no Controle de Acesso.</p>
          </section>
          <section className="dept-board-card">
            <h4>Principais atividades</h4>
            <ul>{info.activities.map((a) => <li key={a}>{a}</li>)}</ul>
          </section>
          {info.flow ? (
            <section className="dept-board-card">
              <h4>Fluxo resumido</h4>
              <p>{info.flow}</p>
            </section>
          ) : null}
        </div>
      </div>
    </details>
  );
}
