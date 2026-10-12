import React, { useMemo } from 'react'
import { ArrowRight, BookOpen, CheckCircle2, FileCheck2, FolderTree, Plus, Search, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getHomeSummary, getKnowledgeCatalog } from '../api/knowledge'
import type { KnowledgeCatalogResponse } from '../api/knowledge'
import type { HomeSummary } from '../types/governance'
import { usePermission } from '../hooks/usePermission'
import { useAuth } from '../auth/useAuth'
import { useLanguage } from '../i18n/LanguageProvider'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { PageTransition } from '../components/ui/PageTransition'

export default function HomePage() {
  const { data: summary, error: loadError } = useAsyncResource<HomeSummary>('home-summary', getHomeSummary)
  const { data: catalog, error: catalogError, reload: reloadCatalog } = useAsyncResource<KnowledgeCatalogResponse>('home-catalog', getKnowledgeCatalog)
  const { has } = usePermission()
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const ownerCoverage = useMemo(() => summary ? Math.max(0, Math.min(100, summary.with_owner_percent)) : 0, [summary])

  if (!summary) return loadError
    ? <div className="page-shell-wide"><div role="alert" className="rounded-surface border border-destructive/25 bg-destructive/10 px-4 py-3 text-body text-destructive-text">Failed to load. Please retry.</div></div>
    : <div className="grid min-h-[65vh] place-items-center"><div className="flex items-center gap-3 text-body text-muted-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" />Loading knowledge…</div></div>

  const firstName = user?.name?.split(' ')[0] || (language === 'vi' ? 'bạn' : 'there')
  const departments = (catalog?.departments ?? []).filter((department) => department.name !== 'Unassigned')
  const spaces = departments.slice(0, 4).map((department) => ({
    ...department,
    detail: language === 'vi'
      ? `${department.count} tài liệu đã xuất bản bạn có quyền truy cập`
      : `${department.count} published document${department.count === 1 ? '' : 's'} you can access`,
  }))
  const departmentCount = catalog ? departments.length : summary.departments

  return <PageTransition className="-mx-3 -my-4 sm:-mx-5 lg:-mx-7">
    <section className="relative overflow-hidden bg-primary px-5 py-12 text-primary-foreground sm:px-8 lg:px-[max(3rem,6vw)] lg:py-16">
      <div className="pointer-events-none absolute -bottom-40 right-0 text-[22rem] font-bold leading-none text-white/[.025]">Q</div>
      <div className="relative max-w-5xl">
        <p className="font-mono text-caption font-medium uppercase tracking-[.12em] text-white/65">QNSC Knowledge Workspace</p>
        <h1 className="mt-4 max-w-4xl font-display text-4xl font-bold leading-[1.08] tracking-[-.045em] text-white sm:text-5xl lg:text-6xl">
          {language === 'vi' ? <>Chào {firstName}. Bạn muốn <span className="text-[#c7eb72]">biết hoặc làm gì</span> hôm nay?</> : <>Hello {firstName}. What do you want to <span className="text-[#c7eb72]">know or do</span> today?</>}
        </h1>
        <p className="mt-4 max-w-2xl text-body-lg leading-7 text-white/70">{t('home.subtitle')}</p>
        <form action="/search" className="mt-8 flex max-w-4xl flex-col gap-2 rounded-panel bg-white p-2 shadow-modal sm:flex-row sm:items-center">
          <Search size={19} className="ml-3 hidden shrink-0 text-primary sm:block" />
          <input name="q" aria-label="Search knowledge" placeholder={t('header.searchPlaceholder')} className="min-h-11 min-w-0 flex-1 bg-transparent px-3 text-body text-foreground outline-none placeholder:text-muted" />
          <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-surface bg-info px-5 text-body-sm font-bold text-info-foreground transition hover:bg-info/90">{language === 'vi' ? 'Khám phá tri thức' : 'Explore knowledge'} <ArrowRight size={14} /></button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2 text-body-sm">
          <Link to="/ai?prompt=Tóm tắt quy trình đầu tư mới nhất" className="rounded-full border border-white/20 bg-white/[.06] px-3 py-1.5 text-white/75 no-underline hover:bg-white/10 hover:text-white">{language === 'vi' ? 'Tóm tắt quy trình đầu tư mới nhất' : 'Summarize the latest investment process'}</Link>
          <Link to="/ai?prompt=Ai có quyền sửa QĐ-214?" className="rounded-full border border-white/20 bg-white/[.06] px-3 py-1.5 text-white/75 no-underline hover:bg-white/10 hover:text-white">{language === 'vi' ? 'Ai có quyền sửa QĐ-214?' : 'Who can update QĐ-214?'}</Link>
        </div>
      </div>
    </section>

    <div className="page-shell-wide space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <section>
        <div className="mb-3 flex items-end justify-between gap-4"><div><h2 className="font-display text-h3 font-bold text-foreground">{language === 'vi' ? 'Không gian tri thức' : 'Knowledge spaces'}</h2><p className="mt-1 text-body-sm text-muted-foreground">{language === 'vi' ? 'Đi thẳng vào phạm vi công việc của bạn.' : 'Go directly to the part of the business you work with.'}</p></div><Link to="/articles" className="text-body-sm font-bold text-primary">{language === 'vi' ? `Xem ${departmentCount} phòng ban` : `View ${departmentCount} departments`} →</Link></div>
        {!catalog && !catalogError ? <div aria-label={language === 'vi' ? 'Đang tải phòng ban' : 'Loading departments'} className="grid overflow-hidden rounded-panel border border-border bg-surface sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => <div key={index} className="min-h-36 animate-pulse border-b border-border p-5 sm:border-r xl:border-b-0 last:border-r-0"><div className="h-3 w-16 rounded bg-surface-muted" /><div className="mt-9 h-5 w-2/3 rounded bg-surface-muted" /><div className="mt-3 h-3 w-4/5 rounded bg-surface-muted" /></div>)}
        </div> : catalogError ? <div role="alert" className="rounded-panel border border-warning/30 bg-warning/10 px-5 py-6"><h3 className="font-display text-body font-bold text-foreground">{language === 'vi' ? 'Chưa tải được phòng ban' : 'Departments could not be loaded'}</h3><p className="mt-1 text-body-sm text-muted-foreground">{language === 'vi' ? 'Các phần khác của trang vẫn hoạt động bình thường.' : 'The rest of this page is still available.'}</p><button type="button" onClick={() => { void reloadCatalog().catch(() => undefined) }} className="mt-4 min-h-10 rounded-control border border-border bg-surface px-4 text-body-sm font-bold text-primary hover:bg-surface-elevated">{language === 'vi' ? 'Thử lại' : 'Retry'}</button></div> : spaces.length ? <div className="grid overflow-hidden rounded-panel border border-border bg-surface sm:grid-cols-2 xl:grid-cols-4">
          {spaces.map((space, index) => <Link key={space.name} to={`/articles?dept=${encodeURIComponent(space.name)}`} className="group relative min-h-36 border-b border-border p-5 text-foreground no-underline transition hover:bg-surface-elevated sm:border-r xl:border-b-0 last:border-r-0">
            <span className="font-mono text-caption text-muted">{String(index + 1).padStart(2, '0')} / SPACE</span><span className="absolute right-4 top-4 font-mono text-h4 text-muted/50">{space.count}</span>
            <h3 className="mt-7 font-display text-body-lg font-bold group-hover:text-primary">{space.name}</h3><p className="mt-1 text-body-sm leading-5 text-muted-foreground">{space.detail}</p>
          </Link>)}
        </div> : <div className="rounded-panel border border-dashed border-border bg-surface px-5 py-9 text-center"><FolderTree size={22} className="mx-auto text-muted" /><h3 className="mt-3 font-display text-body font-bold text-foreground">{language === 'vi' ? 'Chưa có không gian phòng ban' : 'No department spaces yet'}</h3><p className="mx-auto mt-1 max-w-xl text-body-sm text-muted-foreground">{language === 'vi' ? 'Các phòng ban sẽ xuất hiện tại đây khi tài liệu đã xuất bản được gắn đúng phạm vi.' : 'Departments will appear here when published documents are assigned to them.'}</p></div>}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,.55fr)]">
        <article>
          <div className="mb-3 flex items-end justify-between"><div><h2 className="font-display text-h3 font-bold text-foreground">{language === 'vi' ? 'Tri thức vừa được soát xét' : 'Recently reviewed knowledge'}</h2><p className="mt-1 text-body-sm text-muted-foreground">{language === 'vi' ? 'Nội dung mới nhất đã qua kiểm tra.' : 'The latest knowledge that passed review.'}</p></div><Link to="/articles" className="text-body-sm font-bold text-primary">{language === 'vi' ? 'Mở thư viện' : 'Open library'} →</Link></div>
          <div className="border-t border-foreground">
            {summary.recent.length ? summary.recent.map((article, index) => <Link key={article.id} to={`/articles/${article.id}`} className="group grid grid-cols-[3rem_minmax(0,1fr)_auto_1.25rem] items-center gap-3 border-b border-border py-4 text-foreground no-underline">
              <span className="font-mono text-body-sm text-muted">{String(index + 1).padStart(2, '0')}</span><div className="min-w-0"><h3 className="truncate text-body font-bold group-hover:text-primary">{article.title}</h3><p className="mt-1 truncate text-body-sm text-muted-foreground">{article.dept || 'Unassigned department'} · {article.owner || 'No owner'}</p></div><span className="hidden text-body-sm font-semibold text-success-text sm:block">{article.needs_update ? (language === 'vi' ? 'Cần rà soát' : 'Review due') : (language === 'vi' ? 'Đã xác minh' : 'Verified')}</span><ArrowRight size={15} className="text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>) : <div className="py-12 text-center text-body text-muted-foreground">Your recently reviewed documents will appear here.</div>}
          </div>
        </article>

        <aside className="rounded-panel bg-surface-muted p-5">
          <h2 className="font-display text-h4 font-bold text-foreground">{language === 'vi' ? 'Cần bạn chú ý' : 'Needs your attention'}</h2>
          {has('governance.read') && <Link to="/governance/pending-drafts" className="mt-4 block border-t border-border py-4 text-foreground no-underline"><div className="flex items-center gap-2"><FileCheck2 size={15} className="text-warning-text" /><strong className="text-body-sm">{summary.pending_drafts} {language === 'vi' ? 'bản nháp đang chờ duyệt' : 'drafts await review'}</strong></div><p className="mt-2 text-body-sm leading-5 text-muted-foreground">{t('home.waitingDecision')}</p></Link>}
          <Link to="/governance/gap-queue" className="block border-t border-border py-4 text-foreground no-underline"><div className="flex items-center gap-2"><Search size={15} className="text-info-text" /><strong className="text-body-sm">{summary.open_gaps} {language === 'vi' ? 'khoảng trống tri thức' : 'open knowledge gaps'}</strong></div><p className="mt-2 text-body-sm leading-5 text-muted-foreground">{t('home.questionsNoAnswer')}</p></Link>
          <Link to="/governance/health" className="block border-t border-border py-4 text-foreground no-underline"><div className="flex items-center gap-2"><ShieldCheck size={15} className="text-success-text" /><strong className="text-body-sm">{ownerCoverage}% {language === 'vi' ? 'có chủ sở hữu' : 'with clear ownership'}</strong></div><p className="mt-2 text-body-sm leading-5 text-muted-foreground">{summary.needs_review} {language === 'vi' ? 'bài cần rà soát lại' : 'articles need review'}</p></Link>
        </aside>
      </section>

      {has('article.create') && <footer className="flex flex-wrap items-center gap-3 border-t border-border pt-5"><Link to="/articles/new" className="inline-flex min-h-10 items-center gap-2 rounded-control bg-primary px-4 text-body-sm font-bold text-primary-foreground no-underline"><Plus size={15} />{t('home.newArticle')}</Link><span className="ml-auto hidden items-center gap-2 text-body-sm text-muted lg:flex"><CheckCircle2 size={14} className="text-success-text" /> Source storage secured</span></footer>}
    </div>
  </PageTransition>
}
