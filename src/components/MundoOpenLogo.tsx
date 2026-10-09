import React from 'react'

export interface MundoOpenLogoProps {
  className?: string
  /**
   * 'full': Ícone quadrado + "mundo open tecnologia"
   * 'icon': Apenas o símbolo gráfico (quadrado cinza com abertura superior e miolo teal/verde)
   * 'horizontal': Layout horizontal compacto para headers/sidebars
   */
  variant?: 'full' | 'icon' | 'horizontal'
  /** Altura do logotipo em pixels ou classes tailwind (padrão varia com variant) */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Forçar texto branco/claro quando usado sobre fundo escuro */
  inverted?: boolean
  /** Subtítulo customizável opcional abaixo da wordmark (ex: "Onboarding de Colaboradores") */
  subtitle?: string
}

/**
 * Ícone vetorial da Mundo Open:
 * Moldura externa cinza chumbo arredondada em formato de 'C' ou conector/uvertura no topo,
 * com miolo/tela quadrada teal/verde arredondada no interior.
 */
export function MundoOpenIcon({
  className = 'w-9 h-9',
  tealColor = '#008D96',
  darkColor = '#4A4F55',
}: {
  className?: string
  tealColor?: string
  darkColor?: string
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Mundo Open"
    >
      {/* Moldura cinza externa com abertura no topo (letra O estilizada do Open) */}
      <path
        d="M 37 10
           L 26 10
           C 17 10 10 17 10 26
           L 10 74
           C 10 83 17 90 26 90
           L 74 90
           C 83 90 90 83 90 74
           L 90 26
           C 90 17 83 10 74 10
           L 63 10
           L 63 24
           L 72 24
           C 74.2 24 76 25.8 76 28
           L 76 72
           C 76 74.2 74.2 76 72 76
           L 28 76
           C 25.8 76 24 74.2 24 72
           L 24 28
           C 24 25.8 25.8 24 28 24
           L 37 24
           Z"
        fill={darkColor}
      />
      {/* Miolo central teal / verde característico da marca */}
      <rect x="32" y="28" width="36" height="44" rx="6" ry="6" fill={tealColor} />
    </svg>
  )
}

/**
 * Componente SVG/JSX completo da marca Mundo Open Tecnologia
 */
export default function MundoOpenLogo({
  className = '',
  variant = 'full',
  size = 'md',
  inverted = false,
  subtitle,
}: MundoOpenLogoProps) {
  const tealColor = '#008D96'
  const darkTextColor = inverted ? '#FFFFFF' : '#474D52'
  const subtextColor = inverted ? '#A5F3FC' : '#008D96'

  if (variant === 'icon') {
    const iconSizeClasses = {
      sm: 'w-7 h-7',
      md: 'w-9 h-9',
      lg: 'w-12 h-12',
      xl: 'w-16 h-16',
    }[size]

    return (
      <div className={`inline-flex items-center justify-center shrink-0 ${className}`}>
        <MundoOpenIcon
          className={iconSizeClasses}
          tealColor={tealColor}
          darkColor={inverted ? '#E5E7EB' : '#474D52'}
        />
      </div>
    )
  }

  // Variant 'full' ou 'horizontal'
  const iconDimensions = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-13 h-13',
    xl: 'w-16 h-16',
  }[size]

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Ícone da marca */}
      <MundoOpenIcon
        className={`${iconDimensions} shrink-0`}
        tealColor={tealColor}
        darkColor={inverted ? '#F3F4F6' : '#474D52'}
      />

      {/* Tipografia da marca: "mundo open" e "tecnologia" */}
      <div className="flex flex-col justify-center leading-none">
        {/* Wordmark mundo open */}
        <div className="flex flex-col">
          <span
            className="text-[11px] sm:text-xs font-bold tracking-tight lowercase -mb-0.5"
            style={{ color: darkTextColor, letterSpacing: '-0.02em' }}
          >
            mundo
          </span>
          <span
            className="text-lg sm:text-xl font-black lowercase tracking-tight -mt-1"
            style={{ color: darkTextColor, letterSpacing: '-0.03em' }}
          >
            open
          </span>
        </div>

        {/* Sub-assinatura tecnologia (em teal) */}
        <span
          className="text-[9px] sm:text-[10px] font-semibold lowercase tracking-wider mt-0.5"
          style={{ color: subtextColor, letterSpacing: '0.08em' }}
        >
          tecnologia
        </span>

        {/* Subtítulo do sistema se fornecido */}
        {subtitle && (
          <span
            className={`text-[10px] font-medium mt-1 truncate ${
              inverted ? 'text-cyan-200' : 'text-gray-500'
            }`}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  )
}
