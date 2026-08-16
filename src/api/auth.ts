import client from './client'

export async function login(credentials: { username: string; password: string }) {
  const form = new URLSearchParams()
  form.set('username', credentials.username)
  form.set('password', credentials.password)
  const response = await client.post('/auth/login', form, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })
  return response.data
}

export async function getOidcConfig() {
  return (await client.get('/auth/oidc/config')).data
}

export async function getMicrosoftLoginUrl() {
  return (await client.get('/auth/entra/login')).data as { authorization_url: string }
}

export async function register(data: any) {
  const response = await client.post('/auth/register', data)
  return response.data
}

export async function getMe() {
  const response = await client.get('/auth/me')
  return response.data
}

export async function logoutSession() {
  await client.post('/auth/logout')
}

export async function listUsers() {
  const response = await client.get('/auth/users')
  return response.data
}

export async function listDepartments() {
  return (await client.get('/auth/departments')).data
}

export async function listAccessGroups() {
  return (await client.get('/auth/groups')).data
}

export async function createDepartment(data: { name: string; description: string; company_domain?: string }) {
  return (await client.post('/auth/departments', data)).data
}

export async function updateDepartment(departmentId: string, data: { name?: string; description?: string; active?: boolean }) {
  return (await client.patch(`/auth/departments/${departmentId}`, data)).data
}

export async function deleteDepartment(departmentId: string) {
  return (await client.delete(`/auth/departments/${departmentId}`)).data
}

export async function updateUser(userId: string, data: { name?: string; dept?: string | null; department_ids?: string[]; role?: string; role_ids?: string[]; owned_department_ids?: string[]; password?: string; active?: boolean }) {
  const response = await client.patch(`/auth/users/${userId}`, data)
  return response.data
}

export async function createManagedUser(data: { email: string; name: string; password?: string; dept?: string; department_ids?: string[]; role: string; role_ids?: string[]; owned_department_ids?: string[] }) {
  const response = await client.post('/auth/users', data)
  return response.data
}

export async function deactivateUser(userId: string) {
  const response = await client.delete(`/auth/users/${userId}`)
  return response.data
}

export async function assignCompanyCeo(companyDomain: string, userId: string) {
  const response = await client.post(`/auth/companies/${encodeURIComponent(companyDomain)}/ceo`, null, { params: { user_id: userId } })
  return response.data
}

export async function listPermissions() {
  return (await client.get('/auth/permissions')).data
}

export async function listRoles() {
  return (await client.get('/auth/roles')).data
}

export async function createRole(data: { name: string; description?: string; company_domain?: string }) {
  return (await client.post('/auth/roles', data)).data
}

export async function updateRole(roleId: string, data: { name?: string; description?: string; active?: boolean }) {
  return (await client.patch(`/auth/roles/${roleId}`, data)).data
}

export async function deleteRole(roleId: string) {
  return (await client.delete(`/auth/roles/${roleId}`)).data
}

export async function replaceRolePermissions(roleId: string, permissions: { permission_key: string; scope: string }[]) {
  return (await client.put(`/auth/roles/${roleId}/permissions`, permissions)).data
}

export async function replaceUserRoles(userId: string, roleIds: string[]) {
  return (await client.put(`/auth/users/${userId}/roles`, roleIds)).data
}
