/**
 * Tokens de diseño de SGEA.
 * La paleta activa es la institucional que ya usa el sistema (azul UMSA y dorado).
 * La paleta MOF queda disponible para los otros sistemas, sin reemplazar esta.
 */

export const INSTITUTIONAL = {
  canvas: '#f8f9fa',
  surface: '#ffffff',
  border: '#e2e8f0',
  borderRgba: 'rgba(1, 34, 72, 0.12)',
  petroleo: '#012248',
  turquesa: '#0070BB',
  marfil: '#f4f7fb',
  acero: '#003B71',
  coral: '#BC9C31',
  rojo: '#dc2626',
  verde: '#059669',
  ambar: '#d97706',
  ambarBg: '#fff7ed',
  ambarText: '#9a3412',
  titleColor: '#012248',
  subtitleColor: '#003B71',
  textMain: '#1e293b',
  textMuted: '#64748b',
  placeholder: '#94a3b8',
  gridline: '#e2e8f0',
  tableHover: 'rgba(0, 112, 187, 0.06)',
  tableHeadBg: 'rgba(1, 34, 72, 0.06)',
} as const

export const INSTITUTIONAL_DARK = {
  ...INSTITUTIONAL,
  canvas: '#030712',
  surface: '#111827',
  border: '#334155',
  borderRgba: 'rgba(147, 197, 253, 0.25)',
  petroleo: '#93c5fd',
  turquesa: '#38bdf8',
  marfil: 'rgba(188, 156, 49, 0.12)',
  acero: '#7dd3fc',
  coral: '#BC9C31',
  rojo: '#f87171',
  verde: '#34d399',
  ambar: '#fbbf24',
  ambarBg: 'rgba(245, 158, 11, 0.15)',
  ambarText: '#fcd34d',
  titleColor: '#f8fafc',
  subtitleColor: '#93c5fd',
  textMain: '#f1f5f9',
  textMuted: '#94a3b8',
  placeholder: '#64748b',
  gridline: '#1e293b',
  tableHover: 'rgba(56, 189, 248, 0.12)',
  tableHeadBg: 'rgba(15, 23, 42, 0.85)',
} as const

/** Paleta del sistema MOF. No pinta SGEA; se conserva por compatibilidad. */
export const MOF_PALETTE = {
  canvas: '#E4F1DD',
  surface: '#FFFFFF',
  petroleo: '#1A4756',
  turquesa: '#028191',
  marfil: '#E4F1DD',
  acero: '#3C6893',
  coral: '#F04D65',
  rojo: '#D93852',
  verde: '#2E8B57',
  ambar: '#E69F00',
} as const

export const LIGHT_THEME_TOKENS = {
  canvas: MOF_PALETTE.canvas,
  surface: MOF_PALETTE.surface,
  petroleo: MOF_PALETTE.petroleo,
  turquesa: MOF_PALETTE.turquesa,
  marfil: MOF_PALETTE.marfil,
  acero: MOF_PALETTE.acero,
  coral: MOF_PALETTE.coral,
  rojo: MOF_PALETTE.rojo,
  verde: MOF_PALETTE.verde,
  ambar: MOF_PALETTE.ambar,
  titleColor: MOF_PALETTE.petroleo,
  subtitleColor: MOF_PALETTE.acero,
  textMain: '#1E293B',
  textMuted: '#64748B',
}

export const DARK_THEME_TOKENS = INSTITUTIONAL_DARK
export const THEME_COLORS = LIGHT_THEME_TOKENS

export const SERIES_COLORS = [
  MOF_PALETTE.petroleo,
  MOF_PALETTE.turquesa,
  MOF_PALETTE.coral,
  MOF_PALETTE.acero,
  MOF_PALETTE.verde,
] as const

export const vuetifyDefaults = {
  VCard: { elevation: 0, rounded: 'xl', color: 'surface' },
  VBtn: { rounded: 'lg', elevation: 0 },
  VTextField: { variant: 'outlined', density: 'comfortable', color: 'primary' },
  VSelect: { variant: 'outlined', density: 'comfortable', color: 'primary' },
  VAutocomplete: { variant: 'outlined', density: 'comfortable', color: 'primary' },
  VTooltip: { color: INSTITUTIONAL.petroleo },
  VProgressLinear: { color: 'primary', rounded: true },
  VProgressCircular: { color: 'primary' },
}
