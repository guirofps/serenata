// O DOCUMENTO DE QUEM PAGA PELA dLOCAL, POR PAÍS (Ballad, 29/10/2026).
//
// O México nasceu primeiro (`documento-mx.ts`): na página da dLocal a pessoa
// escrevia "ife" ou o RFC sem homoclave e a ficha era recusada. A regra é a
// mesma nos outros países que pagam pela dLocal: o documento é pedido na NOSSA
// folha, conferido aqui e mandado pronto no `payer`; a página deles não pede de
// novo. Os tipos são os que a dLocal Go aceita por país:
//   Colômbia  CC  (cédula de ciudadanía, 6 a 10 dígitos)
//   Chile     RUN (com dígito verificador módulo 11, 0-9 ou K)
//   Peru      DNI (8 dígitos)
//
// Puro, sem imports além do México: a folha e o servidor usam a mesma regra.

import { MENSAGEM_DOCUMENTO_MX, validarDocumentoMx } from "./documento-mx";

export type PaisDocumento = "MX" | "CO" | "CL" | "PE";

export type Documento =
  { ok: true; tipo: string; documento: string } | { ok: false; mensagem: string; motivo: string };

/** O rótulo e a ajuda do campo, em espanhol de cada país. */
export const CAMPO_DOCUMENTO: Record<PaisDocumento, { rotulo: string; sub: string }> = {
  MX: {
    rotulo: "CURP (18 caracteres, viene en tu INE)",
    sub: "OXXO y tu banco piden tu nombre y tu CURP para generar el pago. No se publican ni se comparten.",
  },
  CO: {
    rotulo: "Número de cédula",
    sub: "Tu banco pide tu nombre y tu cédula para generar el pago. No se publican ni se comparten.",
  },
  CL: {
    rotulo: "RUT (ej. 12.345.678-5)",
    sub: "Tu banco pide tu nombre y tu RUT para generar el pago. No se publican ni se comparten.",
  },
  PE: {
    rotulo: "DNI (8 números)",
    sub: "Yape y tu banco piden tu nombre y tu DNI para generar el pago. No se publican ni se comparten.",
  },
};

const NOMES_DE_DOCUMENTO = /^(CC|CEDULA|CÉDULA|RUT|RUN|DNI|CARNET|DOCUMENTO|ID)$/;

/** O dígito verificador do RUN/RUT chileno (módulo 11): "0"-"9" ou "K". */
export function digitoRun(corpo: string): string {
  let soma = 0;
  let mult = 2;
  for (let i = corpo.length - 1; i >= 0; i--) {
    soma += Number(corpo[i]) * mult;
    mult = mult === 7 ? 2 : mult + 1;
  }
  const r = 11 - (soma % 11);
  return r === 11 ? "0" : r === 10 ? "K" : String(r);
}

function erro(motivo: string, mensagem: string): Documento {
  return { ok: false, motivo, mensagem };
}

export function validarDocumento(pais: PaisDocumento, texto: string): Documento {
  if (pais === "MX") {
    const d = validarDocumentoMx(texto);
    return d.ok ? d : erro(d.motivo, MENSAGEM_DOCUMENTO_MX[d.motivo]);
  }
  const bruto = String(texto ?? "")
    .toUpperCase()
    .replace(/[\s.\-_/]/g, "");
  if (!bruto)
    return erro(
      "vazio",
      `Escribe tu ${pais === "CO" ? "cédula" : pais === "CL" ? "RUT" : "DNI"} para generar el pago.`,
    );
  if (NOMES_DE_DOCUMENTO.test(bruto))
    return erro("nome_do_documento", "Escribe el número del documento, no su nombre.");

  if (pais === "CO") {
    if (/^\d{6,10}$/.test(bruto)) return { ok: true, tipo: "CC", documento: bruto };
    return erro("formato", "Tu cédula tiene de 6 a 10 números, sin letras.");
  }
  if (pais === "PE") {
    if (/^\d{8}$/.test(bruto)) return { ok: true, tipo: "DNI", documento: bruto };
    return erro("formato", "Tu DNI tiene 8 números.");
  }
  // Chile: 7 ou 8 dígitos + dígito verificador.
  const m = /^(\d{7,8})([\dK])$/.exec(bruto);
  if (!m)
    return erro("formato", "Escribe tu RUT completo, con el dígito final (ej. 12.345.678-5).");
  if (digitoRun(m[1]) !== m[2])
    return erro("digito", "Ese RUT no cuadra. Revisa los números y el dígito final.");
  return { ok: true, tipo: "RUN", documento: `${m[1]}-${m[2]}` };
}

export function paisTemDocumento(pais: string): pais is PaisDocumento {
  return pais === "MX" || pais === "CO" || pais === "CL" || pais === "PE";
}
