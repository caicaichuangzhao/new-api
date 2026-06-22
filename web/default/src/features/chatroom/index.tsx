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
import { MessagesSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { SectionPageLayout } from '@/components/layout'

export function Chatroom() {
  const { t } = useTranslation()

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Chatroom')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <Empty>
          <EmptyHeader>
            <MessagesSquare />
            <EmptyTitle>{t('Chatroom is not available yet')}</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            {t('This entry is reserved for future real-time user discussion.')}
          </EmptyContent>
        </Empty>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
