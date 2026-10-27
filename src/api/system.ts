import client from './client'
import type { BuildInfo } from '../lib/buildInfo'

interface ServerVersionResponse {
  version: string
  commit: string | null
  environment: string
  started_at: string
}

/** The running backend build. `commit` is '' until the server can tell (see core/build_info.py). */
export async function getServerBuild(): Promise<BuildInfo> {
  const { data } = await client.get<ServerVersionResponse>('/system/version')
  return {
    version: String(data.version ?? ''),
    commit: data.commit ?? '',
    at: data.started_at ?? '',
    environment: data.environment,
  }
}
