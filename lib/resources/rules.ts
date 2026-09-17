import type { PoolClient } from "pg";
import type { Actor } from "@/lib/auth";
import type { ResourceDef } from "@/lib/resources/types";

export type RuleContext = {
  client: PoolClient;
  actor: Actor;
  def: ResourceDef;
  input: Record<string, unknown>;
  before: Record<string, unknown> | null;
  mode: "create" | "update" | "archive" | "restore";
};

/** Regras específicas por cadastro (chave em `ResourceDef.rules`). Lançam AppError com mensagem ao usuário. */
export const RULES: Record<string, (ctx: RuleContext) => Promise<void>> = {};
