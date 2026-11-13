"use client";

import { useEffect, useState } from "react";
import { formatDate, maskBrDate, parseBrDate } from "@/lib/format";

/** Campo de data no padrão brasileiro dd/mm/aa. `value` e `onChange` usam ISO (aaaa-mm-dd) ou "". */
export default function DateInput({
  value,
  onChange,
  max,
}: {
  value: string;
  onChange: (iso: string) => void;
  max?: string;
}) {
  const [text, setText] = useState(formatDate(value));

  // Mudança vinda de fora (ex.: limpar o formulário após enviar)
  useEffect(() => {
    if ((parseBrDate(text) ?? "") !== value) setText(formatDate(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const iso = parseBrDate(text);
  const invalid = text.length >= 8 && !iso;
  const future = !!iso && !!max && iso > max;

  return (
    <>
      <input
        value={text}
        inputMode="numeric"
        placeholder="dd/mm/aa"
        maxLength={8}
        autoComplete="off"
        onChange={(e) => {
          const t = maskBrDate(e.target.value);
          setText(t);
          const p = parseBrDate(t);
          onChange(p && !(max && p > max) ? p : "");
        }}
      />
      {invalid && <small className="hint bad">Data inválida. Use dd/mm/aa, por exemplo 13/11/26.</small>}
      {future && <small className="hint bad">A data não pode ser no futuro.</small>}
    </>
  );
}
