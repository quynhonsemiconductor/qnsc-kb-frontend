import { describe, expect, it } from 'vitest'
import { claudeCodeCommand, clientConfigJson, lifetimeOptions, mcpEndpoint, tokenState } from '../../src/lib/accessTokens'

describe('tokenState', () => {
  it('reports revoked before expired', () => {
    expect(tokenState({ revoked: false, expired: false })).toBe('active')
    expect(tokenState({ revoked: false, expired: true })).toBe('expired')
    expect(tokenState({ revoked: true, expired: true })).toBe('revoked')
  })
})

describe('lifetimeOptions', () => {
  it('never offers more than the server allows', () => {
    expect(lifetimeOptions(365)).toEqual([30, 90, 180, 365])
    expect(lifetimeOptions(100)).toEqual([30, 90])
    expect(lifetimeOptions(7)).toEqual([7])
  })
})

describe('mcpEndpoint', () => {
  it('uses the API origin and the server-reported path', () => {
    expect(mcpEndpoint('https://api.qnsc.vn/api/v1', '/api/v1/mcp', 'https://kb.qnsc.vn')).toBe('https://api.qnsc.vn/api/v1/mcp')
  })
  it('falls back to the page origin when the API base is relative', () => {
    expect(mcpEndpoint(undefined, '/api/v1/mcp', 'http://localhost:5173')).toBe('http://localhost:5173/api/v1/mcp')
    expect(mcpEndpoint('/api/v1', '/api/v1/mcp', 'https://kb.qnsc.vn')).toBe('https://kb.qnsc.vn/api/v1/mcp')
  })
})

describe('client snippets', () => {
  it('embed the url and token', () => {
    const url = 'https://api.qnsc.vn/api/v1/mcp'
    expect(claudeCodeCommand(url, 'kbpat_x')).toContain(`${url} --header "Authorization: Bearer kbpat_x"`)
    const config = JSON.parse(clientConfigJson(url, 'kbpat_x'))
    expect(config.mcpServers['qnsc-kb'].args).toEqual(['mcp-remote', url, '--header', 'Authorization: Bearer kbpat_x'])
  })
})
