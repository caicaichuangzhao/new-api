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

import React, { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Empty,
  Modal,
  Space,
  Table,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { API, timestamp2string } from '../../../helpers';
import { renderMoneyQuota } from '../../../helpers/quota';
import { useIsMobile } from '../../../hooks/common/useIsMobile';

const { Text } = Typography;

const STATUS_CONFIG = {
  pending: { type: 'warning', key: '待审核' },
  approved: { type: 'success', key: '已通过' },
  rejected: { type: 'danger', key: '已拒绝' },
  cancelled: { type: 'default', key: '已撤回' },
};

const AffiliateWithdrawalRecordsModal = ({
  t,
  visible,
  onCancel,
  onChanged,
}) => {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadRecords = async (
    currentPage = page,
    currentPageSize = pageSize,
  ) => {
    setLoading(true);
    try {
      const res = await API.get(
        `/api/user/affiliate_withdrawal?p=${currentPage}&page_size=${currentPageSize}`,
      );
      const { success, message, data } = res.data;
      if (success) {
        setRecords(data.items || []);
        setTotal(data.total || 0);
      } else {
        Toast.error({ content: message || t('加载失败') });
      }
    } catch (e) {
      Toast.error({ content: t('加载失败') });
    } finally {
      setLoading(false);
    }
  };

  const cancelRecord = async (id) => {
    try {
      const res = await API.post(`/api/user/affiliate_withdrawal/${id}/cancel`);
      if (res.data?.success) {
        Toast.success({ content: t('已撤回') });
        await loadRecords();
        onChanged?.();
      } else {
        Toast.error({ content: res.data?.message || t('操作失败') });
      }
    } catch (e) {
      Toast.error({ content: t('操作失败') });
    }
  };

  useEffect(() => {
    if (visible) {
      loadRecords(page, pageSize);
    }
  }, [visible, page, pageSize]);

  const columns = useMemo(
    () => [
      {
        title: 'ID',
        dataIndex: 'id',
      },
      {
        title: t('提现额度'),
        dataIndex: 'quota',
        render: (quota) => <Text>{renderMoneyQuota(quota)}</Text>,
      },
      {
        title: t('支付宝信息'),
        key: 'alipay',
        render: (_, record) => (
          <Space vertical spacing={1}>
            <Text>{record.alipay_name}</Text>
            <Text type='tertiary' copyable>
              {record.alipay_account}
            </Text>
          </Space>
        ),
      },
      {
        title: t('状态'),
        dataIndex: 'status',
        render: (status) => {
          const config = STATUS_CONFIG[status] || {
            type: 'default',
            key: status,
          };
          return (
            <span className='flex items-center gap-2'>
              <Badge dot type={config.type} />
              <span>{t(config.key)}</span>
            </span>
          );
        },
      },
      {
        title: t('审核说明'),
        dataIndex: 'reject_reason',
        render: (reason) => reason || '-',
      },
      {
        title: t('创建时间'),
        dataIndex: 'created_at',
        render: timestamp2string,
      },
      {
        title: t('操作'),
        key: 'action',
        render: (_, record) =>
          record.status === 'pending' ? (
            <Button
              size='small'
              type='danger'
              theme='outline'
              onClick={() => cancelRecord(record.id)}
            >
              {t('撤回')}
            </Button>
          ) : null,
      },
    ],
    [t],
  );

  return (
    <Modal
      title={t('提现记录')}
      visible={visible}
      onCancel={onCancel}
      footer={null}
      size={isMobile ? 'full-width' : 'large'}
    >
      <Table
        columns={columns}
        dataSource={records}
        loading={loading}
        rowKey='id'
        pagination={{
          currentPage: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOpts: [10, 20, 50],
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setPage(1);
          },
        }}
        size='small'
        empty={
          <Empty
            image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
            darkModeImage={
              <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
            }
            description={t('暂无提现记录')}
            style={{ padding: 30 }}
          />
        }
      />
    </Modal>
  );
};

export default AffiliateWithdrawalRecordsModal;
