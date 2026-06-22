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
import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { normalizeCustomUrl } from '@/lib/custom-navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { SectionPageLayout } from '@/components/layout'

type ExternalSiteProps = {
  title?: string
  url?: string
}

export function ExternalSite({ title, url }: ExternalSiteProps) {
  const { t } = useTranslation()
  const safeUrl = normalizeCustomUrl(url)
  const displayTitle = title?.trim() || t('External site')

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>{displayTitle}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        {safeUrl ? (
          <Button
            variant='outline'
            render={<a href={safeUrl} target='_blank' />}
          >
            <ExternalLink />
            {t('Open in new tab')}
          </Button>
        ) : null}
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        {!safeUrl ? (
          <Alert>
            <AlertTitle>{t('Invalid link')}</AlertTitle>
            <AlertDescription>
              {t('The configured URL is empty or not supported.')}
            </AlertDescription>
          </Alert>
        ) : (
          <div className='bg-background h-[calc(100svh-9rem)] overflow-hidden rounded-lg border'>
            <iframe
              src={safeUrl}
              title={displayTitle}
              className='h-full w-full border-0'
              sandbox='allow-downloads allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts'
              referrerPolicy='no-referrer-when-downgrade'
            />
          </div>
        )}
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
