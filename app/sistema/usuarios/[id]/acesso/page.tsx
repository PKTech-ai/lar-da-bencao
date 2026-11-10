import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requirePageActor } from "@/lib/page-auth";
import { hasPermission } from "@/lib/permissions";
import { PersonAccess } from "./person-access";

/** Acesso de uma pessoa aos departamentos. Só o Administrador libera. */
export default async function PersonAccessPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor();
  if (!(await hasPermission(actor, "users", "admin"))) redirect("/sistema");
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>Acesso por departamento</h1>
          <p>Marque o departamento inteiro ou abra para escolher módulo por módulo. Vale ao salvar e fica registrado no Dedo-duro.</p>
        </div>
        <Link className="button" href="/sistema/usuarios">Voltar para Usuários</Link>
      </header>
      <PersonAccess userId={id.data} />
    </>
  );
}
