type PermissionUser = {
  id?: string
  permissions?: string[]
  permission_scopes?: Record<string, string>
  company_domain?: string
  owned_departments?: Array<{ name?: string }>
}

type PermissionArticle = {
  owner_id?: string | null
  company_domain?: string
  dept?: string | null
  departments?: Array<{ name?: string }>
}

/**
 * Match the article edit scope exposed by the API before showing an edit
 * affordance. The API remains the final authority; this only prevents users
 * from being sent to an edit form they cannot use.
 */
export function canEditArticleForUser(user: PermissionUser | null | undefined, article: PermissionArticle | null | undefined) {
  if (!user || !article || !user.permissions?.includes('article.edit')) return false

  const scope = user.permission_scopes?.['article.edit']
  if (scope === 'global') return true
  if (scope === 'company') return article.company_domain === user.company_domain
  if (scope === 'own') return article.owner_id === user.id
  if (scope === 'department') {
    const owned = new Set((user.owned_departments || []).map(item => item.name).filter((value): value is string => Boolean(value)))
    const articleDepartments = new Set([
      article.dept,
      ...(article.departments || []).map(item => item.name),
    ].filter((value): value is string => Boolean(value)))
    return [...articleDepartments].some(department => owned.has(department))
  }

  return false
}
