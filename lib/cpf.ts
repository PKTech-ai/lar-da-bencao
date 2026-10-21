export function cpfDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidCpf(value: string) {
  const digits = cpfDigits(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const check = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) sum += Number(digits[index]) * (length + 1 - index);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

export function formatCpf(value: string) {
  const digits = cpfDigits(value);
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

/** Máscara progressiva: 52998224725 vira 529.982.247-25 enquanto a pessoa digita. */
export function maskCpfInput(raw: string) {
  const digits = cpfDigits(raw).slice(0, 11);
  const a = digits.slice(0, 3);
  const b = digits.slice(3, 6);
  const c = digits.slice(6, 9);
  const d = digits.slice(9, 11);
  if (digits.length <= 3) return a;
  if (digits.length <= 6) return `${a}.${b}`;
  if (digits.length <= 9) return `${a}.${b}.${c}`;
  return `${a}.${b}.${c}-${d}`;
}

export function maskCpf(value: string) {
  const digits = cpfDigits(value);
  return `***.***.***-${digits.slice(9)}`;
}

export const cpfSchemaMessage = "Informe um CPF válido.";
