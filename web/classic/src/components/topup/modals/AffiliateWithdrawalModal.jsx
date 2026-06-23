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

import React, { useEffect, useState } from 'react';
import { Input, InputNumber, Modal, Typography } from '@douyinfe/semi-ui';
import { WalletCards } from 'lucide-react';
import { getCurrencyConfig } from '../../../helpers';
import {
  getQuotaPerUnit,
  moneyAmountToQuota,
  quotaToMoneyAmount,
  renderMoneyQuota,
} from '../../../helpers/quota';

const AffiliateWithdrawalModal = ({
  t,
  visible,
  onCancel,
  onSubmit,
  userState,
  loading,
}) => {
  const [alipayName, setAlipayName] = useState('');
  const [alipayAccount, setAlipayAccount] = useState('');
  const [amount, setAmount] = useState(quotaToMoneyAmount(getQuotaPerUnit()));
  const minimumAmount = quotaToMoneyAmount(getQuotaPerUnit());
  const availableAmount = quotaToMoneyAmount(userState?.user?.aff_quota || 0);

  useEffect(() => {
    if (visible) {
      setAmount(quotaToMoneyAmount(getQuotaPerUnit()));
    }
  }, [visible]);

  return (
    <Modal
      title={
        <div className='flex items-center'>
          <WalletCards className='mr-2' size={18} />
          {t('申请提现')}
        </div>
      }
      visible={visible}
      onOk={() =>
        onSubmit({
          alipay_name: alipayName,
          alipay_account: alipayAccount,
          quota: moneyAmountToQuota(amount),
        })
      }
      onCancel={onCancel}
      confirmLoading={loading}
      maskClosable={false}
      centered
    >
      <div className='space-y-4'>
        <div>
          <Typography.Text strong className='block mb-2'>
            {t('可用邀请额度')}
          </Typography.Text>
          <Input
            value={renderMoneyQuota(userState?.user?.aff_quota || 0)}
            disabled
            className='!rounded-lg'
          />
        </div>
        <div>
          <Typography.Text strong className='block mb-2'>
            {t('支付宝收款姓名')}
          </Typography.Text>
          <Input
            value={alipayName}
            onChange={setAlipayName}
            placeholder={t('请输入真实姓名')}
            className='!rounded-lg'
          />
        </div>
        <div>
          <Typography.Text strong className='block mb-2'>
            {t('支付宝账号')}
          </Typography.Text>
          <Input
            value={alipayAccount}
            onChange={setAlipayAccount}
            placeholder={t('请输入支付宝账号')}
            className='!rounded-lg'
          />
        </div>
        <div>
          <Typography.Text strong className='block mb-2'>
            {t('提现金额')} · {t('最低') + renderMoneyQuota(getQuotaPerUnit())}
          </Typography.Text>
          <InputNumber
            prefix={getCurrencyConfig().symbol}
            min={minimumAmount}
            max={availableAmount}
            step={0.01}
            precision={2}
            value={amount}
            onChange={(value) => setAmount(value)}
            className='w-full !rounded-lg'
          />
        </div>
        <Typography.Text type='tertiary' size='small'>
          {t('提交后额度将暂扣，审核拒绝或主动撤回会自动返还。')}
        </Typography.Text>
      </div>
    </Modal>
  );
};

export default AffiliateWithdrawalModal;
