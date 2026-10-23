import { describe, expect, it } from "vitest";
import { AppError } from "./errors";
import { accessEmailForCpf, initialPasswordForCpf, provisionWorkerAccess } from "./worker-access";

describe("acesso do trabalhador", () => {
  it("usa o CPF como senha e como usuário institucional", () => {
    expect(initialPasswordForCpf("529.982.247-25")).toBe("52998224725");
    expect(accessEmailForCpf("52998224725")).toBe("52998224725@acesso.lardabencao.org");
  });
});

type StoredUser = {
  id: string;
  auth_user_id: string;
  email: string;
  full_name: string;
  role_key: string;
  status: string;
  cpf: string;
  worker_id: string | null;
  must_reset_password: boolean;
  created_by: string;
  departments: string[];
};

function memoryDb(seed: StoredUser[] = []) {
  const users = seed.map((user) => ({ ...user, departments: [...user.departments] }));
  let seq = users.length;
  const query = async (text: string, values: unknown[] = []) => {
    const sql = text.replace(/\s+/g, " ").trim();
    if (sql.startsWith("select id from app.users where worker_id")) {
      const found = users.find((user) => user.worker_id === values[0]);
      return { rows: found ? [{ id: found.id }] : [] };
    }
    if (sql.startsWith("select id, worker_id from app.users where cpf")) {
      const found = users.find((user) => user.cpf === values[0]);
      return { rows: found ? [{ id: found.id, worker_id: found.worker_id }] : [] };
    }
    if (sql.startsWith("update app.users set worker_id")) {
      const user = users.find((item) => item.id === values[0] && item.worker_id == null);
      if (!user) return { rows: [] };
      user.worker_id = String(values[1]);
      return { rows: [{ id: user.id }] };
    }
    if (sql.startsWith("insert into app.users")) {
      const id = `user-${++seq}`;
      users.push({
        id,
        auth_user_id: String(values[0]),
        email: String(values[1]),
        full_name: String(values[2]),
        role_key: sql.includes("'trabalhador'") ? "trabalhador" : "?",
        status: sql.includes("'active'") ? "active" : "?",
        cpf: String(values[3]),
        worker_id: String(values[4]),
        must_reset_password: /must_reset_password/.test(sql) && /true/.test(sql),
        created_by: String(values[5]),
        departments: []
      });
      return { rows: [{ id }] };
    }
    if (sql.startsWith("insert into app.user_departments")) {
      users.find((user) => user.id === values[0])!.departments.push(String(values[1]));
      return { rows: [] };
    }
    throw new Error(`SQL não simulado: ${sql}`);
  };
  return { query, users };
}

const worker = { id: "w-1", full_name: "Maria Teste", cpf: "52998224725", departments: ["doutrina", "infancia"] };

describe("provisionamento do acesso", () => {
  it("recusa ficha sem CPF e não cria conta", async () => {
    const db = memoryDb();
    const createAuthUser = async () => {
      throw new Error("não deveria criar");
    };
    await expect(provisionWorkerAccess(db, { ...worker, cpf: null }, "author", createAuthUser)).rejects.toMatchObject({ code: "CPF_REQUIRED" });
    expect(db.users).toHaveLength(0);
  });

  it("recusa CPF que já pertence a outra conta", async () => {
    const db = memoryDb([{
      id: "user-1", auth_user_id: "auth-old", email: "52998224725@acesso.lardabencao.org", full_name: "Outra",
      role_key: "trabalhador", status: "active", cpf: "52998224725", worker_id: "w-outra", must_reset_password: false,
      created_by: "author", departments: []
    }]);
    let called = false;
    const createAuthUser = async () => {
      called = true;
      return { data: { user: { id: "auth-new" } }, error: null };
    };
    await expect(provisionWorkerAccess(db, worker, "author", createAuthUser)).rejects.toMatchObject({ code: "CPF_IN_USE" });
    expect(called).toBe(false);
  });

  it("vincula a ficha à conta que já usa o CPF, sem criar outro acesso", async () => {
    const db = memoryDb([{
      id: "user-admin", auth_user_id: "auth-admin", email: "admin@lardabencao.org", full_name: "Marcel",
      role_key: "administrador", status: "active", cpf: "52998224725", worker_id: null, must_reset_password: true,
      created_by: "author", departments: []
    }]);
    let called = false;
    const createAuthUser = async () => {
      called = true;
      return { data: { user: { id: "auth-new" } }, error: null };
    };
    const result = await provisionWorkerAccess(db, worker, "author", createAuthUser);
    expect(result).toEqual({ userId: "user-admin", linkedExisting: true });
    expect(called).toBe(false);
    expect(db.users[0]).toMatchObject({
      role_key: "administrador", email: "admin@lardabencao.org", worker_id: "w-1", departments: []
    });
  });

  it("cria o acesso com o CPF, papel trabalhador e os departamentos da ficha", async () => {
    const db = memoryDb();
    const calls: Array<{ email: string; password: string; email_confirm: boolean }> = [];
    const createAuthUser = async (input: { email: string; password: string; email_confirm: boolean }) => {
      calls.push(input);
      return { data: { user: { id: "auth-1" } }, error: null };
    };
    const result = await provisionWorkerAccess(db, worker, "author-1", createAuthUser);
    expect(calls).toEqual([{ email: "52998224725@acesso.lardabencao.org", password: "52998224725", email_confirm: true }]);
    expect(result.createdAuthUserId).toBe("auth-1");
    expect(db.users[0]).toMatchObject({
      role_key: "trabalhador", must_reset_password: true, cpf: "52998224725", worker_id: "w-1",
      email: "52998224725@acesso.lardabencao.org", departments: ["doutrina", "infancia"]
    });
  });

  it("não cria outra conta quando a ficha já tem acesso", async () => {
    const db = memoryDb([{
      id: "user-1", auth_user_id: "auth-1", email: "52998224725@acesso.lardabencao.org", full_name: "Maria Teste",
      role_key: "trabalhador", status: "active", cpf: "52998224725", worker_id: "w-1", must_reset_password: true,
      created_by: "author", departments: ["doutrina"]
    }]);
    let called = false;
    const createAuthUser = async () => {
      called = true;
      return { data: { user: { id: "auth-2" } }, error: null };
    };
    const result = await provisionWorkerAccess(db, worker, "author", createAuthUser);
    expect(result).toEqual({ userId: "user-1" });
    expect(called).toBe(false);
    expect(db.users).toHaveLength(1);
  });

  it("repassa a recusa do Auth sem gravar usuário", async () => {
    const db = memoryDb();
    const createAuthUser = async () => ({ data: { user: null }, error: { message: "Password should be at least 6 characters." } });
    await expect(provisionWorkerAccess(db, worker, "author", createAuthUser)).rejects.toBeInstanceOf(AppError);
    await expect(provisionWorkerAccess(db, worker, "author", createAuthUser)).rejects.toMatchObject({
      message: "Password should be at least 6 characters.",
      code: "AUTH_CREATE_FAILED"
    });
    expect(db.users).toHaveLength(0);
  });
});
