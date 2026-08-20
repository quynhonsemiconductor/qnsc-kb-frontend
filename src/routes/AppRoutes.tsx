import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import ProtectedRoute from './ProtectedRoute'

const LoginPage = lazy(() => import('../auth/LoginPage'))
const HomePage = lazy(() => import('../pages/HomePage'))
const BrowsePage = lazy(() => import('../pages/BrowsePage'))
const BookmarksPage = lazy(() => import('../pages/BookmarksPage'))
const SourcesPage = lazy(() => import('../pages/SourcesPage'))
const ArticleListPage = lazy(() => import('../pages/articles/ArticleListPage'))
const ArticleDetailPage = lazy(() => import('../pages/articles/ArticleDetailPage'))
const ArticleEditPage = lazy(() => import('../pages/articles/ArticleEditPage'))
const SearchResultsPage = lazy(() => import('../pages/search/SearchResultsPage'))
const AskPage = lazy(() => import('../pages/ai/AskPage'))
const PendingDraftsPage = lazy(() => import('../pages/governance/PendingDraftsPage'))
const BatchReviewPage = lazy(() => import('../pages/governance/BatchReviewPage'))
const GapQueuePage = lazy(() => import('../pages/governance/GapQueuePage'))
const AuditLogPage = lazy(() => import('../pages/governance/AuditLogPage'))
const HealthDashboardPage = lazy(() => import('../pages/governance/HealthDashboardPage'))
const CoveragePage = lazy(() => import('../pages/governance/CoveragePage'))
const TagsPage = lazy(() => import('../pages/meta/TagsPage'))
const GlossaryPage = lazy(() => import('../pages/meta/GlossaryPage'))
const UsersPage = lazy(() => import('../pages/admin/UsersPage'))
const AccessGroupsPage = lazy(() => import('../pages/admin/AccessGroupsPage'))
const DepartmentsPage = lazy(() => import('../pages/admin/DepartmentsPage'))
const ConnectorsPage = lazy(() => import('../pages/admin/ConnectorsPage'))
const FeatureFlagsPage = lazy(() => import('../pages/admin/FeatureFlagsPage'))
const RolesPage = lazy(() => import('../pages/admin/RolesPage'))
const LLMSettingsPage = lazy(() => import('../pages/admin/LLMSettingsPage'))
const UiCatalogPage = lazy(() => import('../pages/dev/UiCatalogPage'))

export default function AppRoutes() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-steel">Loading…</div>}><Routes>
      <Route path="/login" element={<LoginPage />} />
      {import.meta.env.DEV && <Route path="/dev/ui" element={<UiCatalogPage />} />}
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<HomePage />} />
        <Route path="home" element={<HomePage />} />
        <Route path="browse" element={<BrowsePage />} />
        <Route path="bookmarks" element={<BookmarksPage />} />
        <Route path="sources" element={<ProtectedRoute permission="article.create"><SourcesPage /></ProtectedRoute>} />
        <Route path="articles" element={<ProtectedRoute permission="article.read"><BrowsePage /></ProtectedRoute>} />
        <Route path="articles/manage" element={<ProtectedRoute permission="article.read"><ArticleListPage /></ProtectedRoute>} />
        <Route path="articles/new" element={<ProtectedRoute permission="article.create"><ArticleEditPage /></ProtectedRoute>} />
        <Route path="articles/:id" element={<ProtectedRoute permission="article.read"><ArticleDetailPage /></ProtectedRoute>} />
        <Route path="articles/:id/edit" element={<ProtectedRoute permission="article.edit"><ArticleEditPage /></ProtectedRoute>} />
        <Route path="search" element={<SearchResultsPage />} />
        <Route path="ai" element={<AskPage />} />
        
        {/* Governance */}
        <Route path="governance/pending-drafts" element={<ProtectedRoute permission="governance.read"><PendingDraftsPage /></ProtectedRoute>} />
        <Route path="governance/pending-drafts/:id/batch-review" element={<ProtectedRoute permission="governance.read"><BatchReviewPage /></ProtectedRoute>} />
        <Route path="governance/gap-queue" element={<ProtectedRoute permission="governance.read"><GapQueuePage /></ProtectedRoute>} />
        <Route path="governance/audit-log" element={<ProtectedRoute permission="governance.read"><AuditLogPage /></ProtectedRoute>} />
        <Route path="governance/health" element={<ProtectedRoute permission="governance.read"><HealthDashboardPage /></ProtectedRoute>} />
        <Route path="governance/coverage" element={<ProtectedRoute permission="governance.read"><CoveragePage /></ProtectedRoute>} />
        
        {/* Meta */}
        <Route path="meta/tags" element={<TagsPage />} />
        <Route path="meta/glossary" element={<GlossaryPage />} />
        <Route path="admin/users" element={<ProtectedRoute permission="user.manage"><UsersPage /></ProtectedRoute>} />
        <Route path="admin/access-groups" element={<ProtectedRoute permission="user.manage"><AccessGroupsPage /></ProtectedRoute>} />
        <Route path="admin/departments" element={<ProtectedRoute permission="user.manage"><DepartmentsPage /></ProtectedRoute>} />
        <Route path="admin/connectors" element={<ProtectedRoute permission="connector.manage"><ConnectorsPage /></ProtectedRoute>} />
        <Route path="admin/features" element={<ProtectedRoute permission="role.manage"><FeatureFlagsPage /></ProtectedRoute>} />
        <Route path="admin/roles" element={<ProtectedRoute permission="role.manage"><RolesPage /></ProtectedRoute>} />
        <Route path="admin/llm" element={<ProtectedRoute permission="role.manage"><LLMSettingsPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></Suspense>
  )
}
