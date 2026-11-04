import React, { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Activity, RefreshCw } from 'lucide-react'
import { verifyReviewDeadlines } from '../../api/governance'
import PageHeader from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { InvestigateTab } from '../../components/health/InvestigateTab'
import { OverviewTab } from '../../components/health/OverviewTab'
import { QualityTab } from '../../components/health/QualityTab'
import { useLanguage } from '../../i18n/LanguageProvider'
import { buildHealthSearch, HEALTH_TABS, parseHealthSearch, type HealthLocation, type HealthTab } from '../../lib/investigate'

/**
 * Three views of the same question, "is the knowledge base healthy":
 *
 * - Overview: what is true right now, plus the all-time totals that used to be the whole page.
 * - Investigate: what is failing, where, and which request to open first.
 * - Quality: the offline RAG evaluation.
 *
 * The state lives in the URL (`?tab=investigate&window=6&request=...`), so an investigation can be
 * sent to someone as a link.
 */
export default function HealthDashboardPage() {
  const { t } = useLanguage()
  const [params, setParams] = useSearchParams()
  const location = parseHealthSearch(params.toString())
  const [reviewTick, setReviewTick] = useState(0)
  const [verifying, setVerifying] = useState(false)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const go = (next: Partial<HealthLocation>) => {
    const merged: HealthLocation = { ...location, ...next }
    // A request id only means something on the Investigate tab.
    if (merged.tab !== 'investigate') merged.requestId = ''
    setParams(new URLSearchParams(buildHealthSearch(merged)), { replace: true })
  }

  const runReviewScan = async () => {
    setVerifying(true)
    try {
      await verifyReviewDeadlines()
      setReviewTick((value) => value + 1)
    } finally {
      setVerifying(false)
    }
  }

  const onTabKey = (event: React.KeyboardEvent, index: number) => {
    const last = HEALTH_TABS.length - 1
    const target =
      event.key === 'ArrowRight' ? (index + 1) % HEALTH_TABS.length
      : event.key === 'ArrowLeft' ? (index + last) % HEALTH_TABS.length
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null
    if (target === null) return
    event.preventDefault()
    go({ tab: HEALTH_TABS[target] })
    tabRefs.current[HEALTH_TABS[target]]?.focus()
  }

  const tabLabel = (tab: HealthTab) => t(`health.tab.${tab}`)

  return (
    <div className="page-shell page-stack">
      <PageHeader
        eyebrow={t('health.eyebrow')}
        title={t('health.title')}
        description={t('health.description')}
        icon={Activity}
        actions={
          <Button variant="secondary" size="sm" onClick={() => void runReviewScan().catch(() => undefined)} disabled={verifying} icon={<RefreshCw size={14} className={verifying ? 'animate-spin' : ''} />}>
            {verifying ? t('health.checkingReviews') : t('health.checkReviews')}
          </Button>
        }
      />

      <div role="tablist" aria-label={t('health.tabs')} className="flex gap-1 border-b border-border">
        {HEALTH_TABS.map((tab, index) => {
          const selected = tab === location.tab
          return (
            <button
              key={tab}
              ref={(node) => { tabRefs.current[tab] = node }}
              id={`health-tab-${tab}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`health-panel-${tab}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => go({ tab })}
              onKeyDown={(event) => onTabKey(event, index)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-body-sm font-semibold transition-colors duration-fast ${
                selected ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tabLabel(tab)}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" id={`health-panel-${location.tab}`} aria-labelledby={`health-tab-${location.tab}`}>
        {location.tab === 'overview' && <OverviewTab tick={reviewTick} onInvestigate={() => go({ tab: 'investigate' })} />}
        {location.tab === 'investigate' && (
          <InvestigateTab
            windowHours={location.windowHours}
            onWindowChange={(windowHours) => go({ windowHours })}
            requestId={location.requestId}
            onRequestSearched={(requestId) => go({ requestId })}
          />
        )}
        {location.tab === 'quality' && <QualityTab tick={reviewTick} />}
      </div>
    </div>
  )
}
