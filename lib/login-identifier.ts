import { cpfDigits, isValidCpf } from "@/lib/cpf";

export function loginIdentifier(value: string): { kind: "cpf"; cpf: string } | { kind: "invalid" } {
  const trimmed = value.trim();
  if (!trimmed.includes("@") && isValidCpf(trimmed)) return { kind: "cpf", cpf: cpfDigits(trimmed) };
  return { kind: "invalid" };
}
