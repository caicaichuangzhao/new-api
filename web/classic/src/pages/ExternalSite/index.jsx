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

import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Card, Empty, Space, Typography } from '@douyinfe/semi-ui';
import { ExternalLink } from 'lucide-react';
import { normalizeCustomUrl } from '../../helpers/customNavigation';

const { Title } = Typography;

export default function ExternalSite() {
  const { t } = useTranslation();
  const location = useLocation();
  const { title, safeUrl } = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const rawTitle = params.get('title') || '';
    const rawUrl = params.get('url') || '';
    return {
      title: rawTitle.trim() || t('外部站点'),
      safeUrl: normalizeCustomUrl(rawUrl),
    };
  }, [location.search, t]);

  return (
    <div style={{ padding: 24, height: 'calc(100vh - 64px)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <Title heading={3} style={{ margin: 0 }}>
          {title}
        </Title>
        {safeUrl ? (
          <Space>
            <Button
              icon={<ExternalLink size={16} />}
              onClick={() => window.open(safeUrl, '_blank', 'noopener')}
            >
              {t('在新标签页中打开')}
            </Button>
          </Space>
        ) : null}
      </div>

      <Card bodyStyle={{ padding: 0 }}>
        {safeUrl ? (
          <iframe
            src={safeUrl}
            title={title}
            style={{
              display: 'block',
              width: '100%',
              height: 'calc(100vh - 150px)',
              minHeight: 520,
              border: 0,
              borderRadius: 8,
              background: 'var(--semi-color-bg-1)',
            }}
            sandbox='allow-downloads allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts'
            referrerPolicy='no-referrer-when-downgrade'
          />
        ) : (
          <div style={{ padding: 48 }}>
            <Empty description={t('链接无效或为空')} />
          </div>
        )}
      </Card>
    </div>
  );
}
