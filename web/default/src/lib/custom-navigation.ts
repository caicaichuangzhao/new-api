/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
export type CustomNavigationLink = {
  id: string
  title: string
  url: string
  enabled: boolean
}

const FALLBACK_CUSTOM_LINK_TITLE = 'Custom link'

export function createCustomNavigationLink(): CustomNavigationLink {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  return {
    id: random,
    title: '',
    url: '',
    enabled: true,
  }
}

export function normalizeCustomUrl(value: unknown): string {
  if (typeof value !== 'string') return ''

  const raw = value.trim()
  if (!raw) return ''

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
    ? raw
    : `https://${raw}`

  try {
    const url = new URL(withProtocol)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    return url.toString()
  } catch {
    return ''
  }
}

export function normalizeCustomNavigationLinks(
  value: unknown
): CustomNavigationLink[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null

      const record = item as Record<string, unknown>
      const url = normalizeCustomUrl(record.url)
      const title = typeof record.title === 'string' ? record.title.trim() : ''

      if (!url || !title) return null

      return {
        id:
          typeof record.id === 'string' && record.id.trim()
            ? record.id.trim()
            : `custom-${index}`,
        title,
        url,
        enabled: typeof record.enabled === 'boolean' ? record.enabled : true,
      }
    })
    .filter((item): item is CustomNavigationLink => Boolean(item))
}

export function buildExternalSiteHref(link: CustomNavigationLink): string {
  const params = new URLSearchParams({
    title: link.title || FALLBACK_CUSTOM_LINK_TITLE,
    url: link.url,
  })

  return `/external-site?${params.toString()}`
}
