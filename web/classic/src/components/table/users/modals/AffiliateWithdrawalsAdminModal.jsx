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
  Input,
  Modal,
  Select,
  Space,
  Table,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { API, renderQuota, timestamp2string } from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';

const { Text } = Typography;

const STATUS_CONFIG = {
  pending: { type: 'warning', key: '待审核' },
  approved: { type: 'success', key: '已通过' },
  rejected: { type: 'danger', key: '已拒绝' },
  cancelled: { type: 'default', key: '已撤回' },
};

const AffiliateWithdrawalsAdminModal = ({ visible, onCancel, t }) => {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState('pending');
  const [userId, setUserId] = useState('');
  const [rejectRecord, setRejectRecord] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const loadRecords = async (
    currentPage = page,
    currentPageSize = pageSize,
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        p: String(currentPage),
        page_size: String(currentPageSize),
      });
      if (status) params.set('status', status);
      if (userId) params.set('user_id', userId);
      const res = await API.get(
        `/api/user/affiliate_withdrawal/admin?${params}`,
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

  const reviewRecord = async (record, approved, reason = '') => {
    setReviewing(true);
    try {
      const res = await API.post(
        `/api/user/affiliate_withdrawal/admin/${record.id}/review`,
        {
          approved,
          reject_reason: reason,
        },
      );
      if (res.data?.success) {
        Toast.success({ content: approved ? t('已通过') : t('已拒绝') });
        setRejectRecord(null);
        setRejectReason('');
        await loadRecords();
      } else {
        Toast.error({ content: res.data?.message || t('操作失败') });
      }
    } catch (e) {
      Toast.error({ content: t('操作失败') });
    } finally {
      setReviewing(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadRecords(page, pageSize);
    }
  }, [visible, page, pageSize, status]);

  const columns = useMemo(
    () => [
      {
        title: 'ID',
        dataIndex: 'id',
        width: 72,
      },
      {
        title: t('用户'),
        key: 'user',
        render: (_, record) => (
          <Space vertical spacing={1}>
            <Text>{record.username || '-'}</Text>
            <Text type='tertiary'>ID: {record.user_id}</Text>
          </Space>
        ),
      },
      {
        title: t('提现额度'),
        dataIndex: 'quota',
        render: (quota) => <Text>{renderQuota(quota)}</Text>,
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
        render: (value) => {
          const config = STATUS_CONFIG[value] || {
            type: 'default',
            key: value,
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
        title: t('创建时间'),
        dataIndex: 'created_at',
        render: timestamp2string,
      },
      {
        title: t('操作'),
        key: 'action',
        fixed: 'right',
        render: (_, record) =>
          record.status === 'pending' ? (
            <Space>
              <Button
                size='small'
                type='primary'
                theme='outline'
                onClick={() => reviewRecord(record, true)}
              >
                {t('通过')}
              </Button>
              <Button
                size='small'
                type='danger'
                theme='outline'
                onClick={() => {
                  setRejectRecord(record);
                  setRejectReason('');
                }}
              >
                {t('拒绝')}
              </Button>
            </Space>
          ) : null,
      },
    ],
    [t],
  );

  return (
    <>
      <Modal
        title={t('提现审核')}
        visible={visible}
        onCancel={onCancel}
        footer={null}
        size={isMobile ? 'full-width' : 'large'}
      >
        <div className='flex flex-col md:flex-row gap-2 mb-3'>
          <Select
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            style={{ width: isMobile ? '100%' : 160 }}
          >
            <Select.Option value=''>{t('全部状态')}</Select.Option>
            <Select.Option value='pending'>{t('待审核')}</Select.Option>
            <Select.Option value='approved'>{t('已通过')}</Select.Option>
            <Select.Option value='rejected'>{t('已拒绝')}</Select.Option>
            <Select.Option value='cancelled'>{t('已撤回')}</Select.Option>
          </Select>
          <Input
            value={userId}
            onChange={setUserId}
            placeholder={t('用户ID')}
            showClear
            style={{ width: isMobile ? '100%' : 180 }}
          />
          <Button
            type='primary'
            onClick={() => {
              setPage(1);
              loadRecords(1, pageSize);
            }}
          >
            {t('查询')}
          </Button>
        </div>
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
          scroll={isMobile ? undefined : { x: 'max-content' }}
          empty={
            <Empty
              image={
                <IllustrationNoResult style={{ width: 150, height: 150 }} />
              }
              darkModeImage={
                <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
              }
              description={t('暂无提现记录')}
              style={{ padding: 30 }}
            />
          }
        />
      </Modal>

      <Modal
        title={t('拒绝提现申请')}
        visible={!!rejectRecord}
        onCancel={() => setRejectRecord(null)}
        onOk={() => reviewRecord(rejectRecord, false, rejectReason)}
        confirmLoading={reviewing}
        maskClosable={false}
      >
        <Input.TextArea
          value={rejectReason}
          onChange={setRejectReason}
          placeholder={t('填写拒绝原因')}
          autosize
        />
      </Modal>
    </>
  );
};

export default AffiliateWithdrawalsAdminModal;
