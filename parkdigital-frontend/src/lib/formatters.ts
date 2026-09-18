export const REGEX_PLACA = /^[A-Z]{3}-\d{4}$/;

export function formatarPlaca(valorDigitado: string): string {
  const somenteAlfanumerico = valorDigitado
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 7);

  const letras = somenteAlfanumerico.slice(0, 3);
  const numeros = somenteAlfanumerico.slice(3, 7);

  return numeros ? `${letras}-${numeros}` : letras;
}

export function formatarCpf(valorDigitado: string): string {
  const digitos = valorDigitado.replace(/\D/g, "").slice(0, 11);
  const partes = [digitos.slice(0, 3), digitos.slice(3, 6), digitos.slice(6, 9)];
  const base = partes.filter(Boolean).join(".");
  const verificador = digitos.slice(9, 11);

  return verificador ? `${base}-${verificador}` : base;
}
