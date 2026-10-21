"use client";

import { useId, useState } from "react";
import { completeMoneyInput, contributionMinimumMessage, maskMoneyInput, parseMoney } from "@/lib/resources/types";

function amountError(value: string) {
  if (!value.trim()) return "";
  try {
    return parseMoney(value) < 1 ? contributionMinimumMessage : "";
  } catch {
    return "";
  }
}

/** Valor em reais com separador de milhar e aviso imediato quando fica abaixo de 1 centavo. */
export function ContributionAmountInput({ defaultValue = "" }: { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue ? maskMoneyInput(defaultValue) : "");
  const [error, setError] = useState(() => amountError(defaultValue));
  const errorId = useId();

  function change(raw: string) {
    const masked = maskMoneyInput(raw);
    setValue(masked);
    setError(amountError(masked));
  }

  function blur() {
    const completed = completeMoneyInput(value);
    setValue(completed);
    if (!completed) {
      setError("");
      return;
    }
    try {
      setError(parseMoney(completed) < 1 ? contributionMinimumMessage : "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Informe um valor válido.");
    }
  }

  return (
    <div className="money-field">
      <label className="money-line">R$
        <input
          name="contribution_cents"
          required
          inputMode="decimal"
          maxLength={20}
          autoComplete="off"
          placeholder="0,00"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => change(event.target.value)}
          onBlur={blur}
        />
      </label>
      {error ? <p id={errorId} className="error" role="alert">{error}</p> : null}
    </div>
  );
}
