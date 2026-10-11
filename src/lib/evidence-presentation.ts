import type { AnalyticsResult } from '../types/ai'

export type AnalyticsOperationLabels = Record<AnalyticsResult['operation'], string>

export function analyticsOperationLabel(
  operation: AnalyticsResult['operation'],
  labels: AnalyticsOperationLabels,
): string {
  return labels[operation]
}

export function formatEvidenceRowSummary(template: string, shown: number, total: number): string {
  return template
    .replaceAll('{{shown}}', String(shown))
    .replaceAll('{{total}}', String(total))
}
