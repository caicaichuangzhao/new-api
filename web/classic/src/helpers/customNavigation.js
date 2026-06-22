/*
Copyright (C) 2025 QuantumNous

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

const FALLBACK_CUSTOM_LINK_TITLE = 'Custom link';

export function createCustomNavigationLink() {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id: random,
    title: '',
    url: '',
    enabled: true,
  };
}

export function normalizeCustomUrl(value) {
  if (typeof value !== 'string') return '';

  const raw = value.trim();
  if (!raw) return '';

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
    ? raw
    : `https://${raw}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.toString();
  } catch (error) {
    return '';
  }
}

export function normalizeCustomNavigationLinks(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;

      const url = normalizeCustomUrl(item.url);
      const title = typeof item.title === 'string' ? item.title.trim() : '';

      if (!url || !title) return null;

      return {
        id:
          typeof item.id === 'string' && item.id.trim()
            ? item.id.trim()
            : `custom-${index}`,
        title,
        url,
        enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
      };
    })
    .filter(Boolean);
}

export function buildExternalSitePath(link) {
  const params = new URLSearchParams({
    title: link.title || FALLBACK_CUSTOM_LINK_TITLE,
    url: link.url,
  });

  return `/console/external-site?${params.toString()}`;
}
