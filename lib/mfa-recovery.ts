import { createHash, randomBytes } from "node:crypto";

export const RECOVERY_CODE_COUNT = 10;
export const RECOVERY_MAX_FAILURES = 5;
export const RECOVERY_FAILURE_WINDOW_MINUTES = 15;

/** Aceita o código com ou sem hífens/espaços e em qualquer caixa. */
export function normalizeRecoveryCode(code: string) {
  return code.replace(/[^0-9a-z]/gi, "").toUpperCase();
}

export function hashRecoveryCode(code: string) {
  return createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}

/** 80 bits por código (20 dígitos hex): inviável reverter o SHA-256 mesmo com vazamento do banco. */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    const raw = randomBytes(10).toString("hex").toUpperCase();
    codes.add(raw.match(/.{5}/g)!.join("-"));
  }
  return [...codes];
}

export function recoveryCodeHashes(codes: string[]) {
  return codes.map((code) => ({ code, hash: hashRecoveryCode(code) }));
}

export function isRecoveryLocked(recentFailures: number) {
  return recentFailures >= RECOVERY_MAX_FAILURES;
}
