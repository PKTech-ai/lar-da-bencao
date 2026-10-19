import { cpfDigits, isValidCpf } from "@/lib/cpf";
import { AppError } from "@/lib/errors";

type Queryable = { query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[] }> };

export type CreateAuthUserInput = { email: string; password: string; email_confirm: true };

export type CreateAuthUser = (input: CreateAuthUserInput) => Promise<{
  data: { user: { id: string } | null };
  error: { message: string } | null;
}>;

export function accessEmailForCpf(cpf: string) {
  return `${cpfDigits(cpf)}@acesso.lardabencao.org`;
}

export function initialPasswordForCpf(cpf: string) {
  return cpfDigits(cpf);
}

/** Cria o login do trabalhador admitido. Devolve a conta que já existia sem criar outra. */
export async function provisionWorkerAccess(
  db: Queryable,
  worker: { id: string; full_name: string; cpf: string | null; departments: readonly string[] },
  authorId: string,
  createAuthUser: CreateAuthUser
) {
  if (!worker.cpf || !isValidCpf(worker.cpf)) {
    throw new AppError("Preencha o CPF na ficha antes de aprovar.", 409, "CPF_REQUIRED");
  }
  const cpf = cpfDigits(worker.cpf);
  const linked = await db.query("select id from app.users where worker_id = $1", [worker.id]);
  const linkedId = (linked.rows[0] as { id: string } | undefined)?.id;
  if (linkedId) return { userId: linkedId };

  const taken = await db.query("select id from app.users where cpf = $1", [cpf]);
  if (taken.rows[0]) throw new AppError("Este CPF já tem acesso ao sistema.", 409, "CPF_IN_USE");

  const email = accessEmailForCpf(cpf);
  const created = await createAuthUser({ email, password: initialPasswordForCpf(cpf), email_confirm: true });
  if (created.error || !created.data.user) {
    throw new AppError(created.error?.message ?? "Não foi possível criar o acesso.", 409, "AUTH_CREATE_FAILED");
  }

  const inserted = await db.query(
    `insert into app.users (auth_user_id, email, full_name, role_key, status, cpf, worker_id, must_reset_password, created_by, updated_by)
     values ($1,$2,$3,'trabalhador','active',$4,$5,true,$6,$6) returning id`,
    [created.data.user.id, email, worker.full_name, cpf, worker.id, authorId]
  );
  const userId = (inserted.rows[0] as { id: string }).id;
  for (const department of worker.departments) {
    await db.query("insert into app.user_departments(user_id, department_key) values ($1,$2)", [userId, department]);
  }
  return { userId, createdAuthUserId: created.data.user.id };
}
