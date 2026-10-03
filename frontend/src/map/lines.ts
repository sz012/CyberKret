import type { KretResult, KretTarget } from '../api/types'
import { countLabel } from '../lib/format'

export interface DigLine {
  text: string
  tone?: 'bad' | 'warn' | 'ok' | 'hi'
}

export function resultLine(target: KretTarget): DigLine {
  if (target.open) {
    return { text: `✕ ${target.label}: ${countLabel(target.open, 'droga otwarta', 'drogi otwarte', 'dróg otwartych')}`, tone: 'bad' }
  }
  if (target.possible) {
    return {
      text: `! ${target.label}: ${countLabel(target.possible, 'droga niepewna', 'drogi niepewne', 'dróg niepewnych')}`,
      tone: 'warn',
    }
  }
  return { text: `✓ ${target.label}: nie znalazłem drogi`, tone: 'ok' }
}

export function summaryLines(result: KretResult): DigLine[] {
  return [
    { text: `> ${result.intro}`, tone: 'hi' },
    ...result.targets.map(resultLine),
    { text: `→ ${result.outro}`, tone: 'hi' },
  ]
}
