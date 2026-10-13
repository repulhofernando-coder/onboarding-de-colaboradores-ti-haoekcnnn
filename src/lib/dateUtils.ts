/**
 * Utilitários centralizados para tratamento, formatação e cálculo de datas.
 * Suporta formatos do PocketBase:
 * - ISO com 'T': "2026-10-16T00:00:00.000Z"
 * - ISO com espaço: "2026-10-16 00:00:00.000Z"
 * - Data pura: "2026-10-16"
 * - Timestamps em milissegundos ou instâncias Date
 */

/**
 * Converte qualquer formato de data retornado pelo PocketBase em objeto Date válido.
 * Trata timezone de forma neutra para campos de data pura ("YYYY-MM-DD" ou "YYYY-MM-DD 00:00:00.000Z")
 * garantindo que o dia local não retroceda por causa de fuso horário.
 */
export function parseDate(value?: string | number | Date | null): Date | null {
  if (!value) return null
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value
  }
  if (typeof value === 'number') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }

  const str = String(value).trim()
  if (!str) return null

  // Se tem padrão YYYY-MM-DD no início
  const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (ymdMatch) {
    const ano = parseInt(ymdMatch[1], 10)
    const mes = parseInt(ymdMatch[2], 10) - 1
    const dia = parseInt(ymdMatch[3], 10)

    // Se a string contém apenas a data ou horário zerado (ex: "00:00:00"), cria como data local pura
    const isZeroTime = !str.includes(':') || /00:00:00(?:\.000)?Z?$/.test(str.replace(/\s+/g, 'T'))

    if (isZeroTime) {
      const d = new Date(ano, mes, dia, 0, 0, 0, 0)
      return isNaN(d.getTime()) ? null : d
    }

    // Se tem horário com horas/minutos reais (ex: "2026-10-02 14:30:00.000Z" ou "T14:30:00Z")
    const isoNorm = str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') : str
    const parsed = new Date(isoNorm)
    if (!isNaN(parsed.getTime())) return parsed

    // Fallback: data local com hora
    return new Date(ano, mes, dia, 0, 0, 0, 0)
  }

  // Fallback padrão
  const directDate = new Date(str)
  return isNaN(directDate.getTime()) ? null : directDate
}

/**
 * Extrai ano, mês e dia numéricos de strings como "2026-10-16 00:00:00.000Z" ou "2026-10-16"
 */
export function extractYMD(
  value?: string | null,
): { ano: number; mes: number; dia: number } | null {
  if (!value) return null
  const match = String(value)
    .trim()
    .match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!match) return null
  return {
    ano: parseInt(match[1], 10),
    mes: parseInt(match[2], 10),
    dia: parseInt(match[3], 10),
  }
}

/**
 * Formata data no padrão dd/mm/aaaa (PT-BR) sem horário.
 * Retorna '-' se a data for nula, indefinida ou inválida.
 *
 * Exemplos:
 * formatShortDate("2026-10-16 00:00:00.000Z") => "16/10/2026"
 * formatShortDate("2026-10-16") => "16/10/2026"
 */
export function formatShortDate(value?: string | number | Date | null): string {
  if (!value) return '-'

  // Tenta extração direta regex de YYYY-MM-DD para evitar overhead e desvios de timezone
  if (typeof value === 'string') {
    const ymd = extractYMD(value)
    if (ymd) {
      const diaStr = String(ymd.dia).padStart(2, '0')
      const mesStr = String(ymd.mes).padStart(2, '0')
      return `${diaStr}/${mesStr}/${ymd.ano}`
    }
  }

  const d = parseDate(value)
  if (!d) return '-'

  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const ano = d.getFullYear()
  return `${dia}/${mes}/${ano}`
}

/**
 * Formata data e hora no padrão dd/mm/aaaa às HH:mm (ou dd/mm/aaaa HH:mm).
 * Retorna '-' se inválida.
 */
export function formatDateTime(
  value?: string | number | Date | null,
  options?: { includeHours?: boolean },
): string {
  if (!value) return '-'
  const d = parseDate(value)
  if (!d) return '-'

  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const ano = d.getFullYear()

  if (options?.includeHours === false) {
    return `${dia}/${mes}/${ano}`
  }

  const horas = String(d.getHours()).padStart(2, '0')
  const minutos = String(d.getMinutes()).padStart(2, '0')
  return `${dia}/${mes}/${ano} ${horas}:${minutos}`
}

export interface PrazoDiasInfo {
  /** Quantidade de dias restantes até a data limite (positivo = futuro, 0 = hoje, negativo = vencido) */
  diasRestantes: number | null
  /** Se o prazo já venceu (diasRestantes < 0) */
  isVencido: boolean
  /** Se o prazo vence hoje (diasRestantes === 0) */
  isHoje: boolean
  /** Se está próximo do vencimento (0 <= diasRestantes <= 3) */
  isCritico: boolean
  /** Texto amigável pronto para exibição no badge */
  labelBadge: string
}

/**
 * Calcula a diferença de dias entre hoje (meia-noite local) e a data limite informada.
 * Trata adequadamente strings do PocketBase com "00:00:00.000Z".
 *
 * Regras do badge:
 * - data inválida/ausente: diasRestantes null, labelBadge "—"
 * - diasRestantes < 0: Vencido (isVencido = true)
 * - diasRestantes === 0: Hoje (isHoje = true)
 * - diasRestantes === 1: 1 dia
 * - diasRestantes > 1: X dias
 */
export function calcularDiasRestantes(dataLimite?: string | number | Date | null): PrazoDiasInfo {
  if (!dataLimite) {
    return {
      diasRestantes: null,
      isVencido: false,
      isHoje: false,
      isCritico: false,
      labelBadge: '—',
    }
  }

  const ymd = typeof dataLimite === 'string' ? extractYMD(dataLimite) : null
  let dataFim: Date | null = null

  if (ymd) {
    dataFim = new Date(ymd.ano, ymd.mes - 1, ymd.dia, 0, 0, 0, 0)
  } else {
    dataFim = parseDate(dataLimite)
    if (dataFim) {
      dataFim = new Date(dataFim.getFullYear(), dataFim.getMonth(), dataFim.getDate(), 0, 0, 0, 0)
    }
  }

  if (!dataFim || isNaN(dataFim.getTime())) {
    return {
      diasRestantes: null,
      isVencido: false,
      isHoje: false,
      isCritico: false,
      labelBadge: '—',
    }
  }

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const diffTime = dataFim.getTime() - hoje.getTime()
  // Math.round na diferença de dias à meia-noite evita distorções de horário de verão
  const diasRestantes = Math.round(diffTime / (1000 * 60 * 60 * 24))

  const isVencido = diasRestantes < 0
  const isHoje = diasRestantes === 0
  const isCritico = diasRestantes >= 0 && diasRestantes <= 3

  let labelBadge = ''
  if (isVencido) {
    labelBadge = 'Vencido'
  } else if (isHoje) {
    labelBadge = 'Hoje'
  } else if (diasRestantes === 1) {
    labelBadge = '1 dia'
  } else {
    labelBadge = `${diasRestantes} dias`
  }

  return {
    diasRestantes,
    isVencido,
    isHoje,
    isCritico,
    labelBadge,
  }
}
