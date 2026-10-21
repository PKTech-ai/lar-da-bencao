"use client";

import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange"> & {
  mask: (value: string) => string;
  /** Ajuste ao sair do campo, por exemplo completar os centavos. */
  complete?: (value: string) => string;
  defaultValue?: string;
};

/** Campo controlado que aplica a máscara a cada tecla. O valor enviado continua legível, com a pontuação. */
export function MaskedInput({ mask, complete, defaultValue = "", ...props }: Props) {
  const [value, setValue] = useState(() => (defaultValue ? mask(String(defaultValue)) : ""));
  return (
    <input
      {...props}
      value={value}
      onChange={(event) => setValue(mask(event.target.value))}
      onBlur={() => { if (complete) setValue((current) => complete(current)); }}
    />
  );
}
