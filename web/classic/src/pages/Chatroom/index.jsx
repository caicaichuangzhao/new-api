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

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Empty, Typography } from '@douyinfe/semi-ui';
import { MessagesSquare } from 'lucide-react';

const { Title } = Typography;

export default function Chatroom() {
  const { t } = useTranslation();

  return (
    <div style={{ padding: 24 }}>
      <Title heading={3} style={{ marginTop: 0 }}>
        {t('聊天室')}
      </Title>
      <Card>
        <Empty
          image={<MessagesSquare size={48} color='var(--semi-color-text-2)' />}
          description={t('聊天室暂未开放')}
        />
      </Card>
    </div>
  );
}
