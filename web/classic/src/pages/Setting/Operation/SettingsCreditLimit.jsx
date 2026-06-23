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

import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Banner,
  Button,
  Col,
  Form,
  InputNumber,
  Row,
  Spin,
  Typography,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';

const { Text } = Typography;
const QUOTA_FIELDS = [
  'QuotaForNewUser',
  'PreConsumedQuota',
  'QuotaForInviter',
  'QuotaForInvitee',
];
const DEFAULT_INPUTS = {
  QuotaForNewUser: '',
  PreConsumedQuota: '',
  QuotaForInviter: '',
  QuotaForInvitee: '',
  AffFirstTopUpRewardRatio: 0,
  AffConsumptionRewardRatio: 0,
  GoldQuotaExchangeRate: 1,
  'quota_setting.enable_free_model_pre_consume': true,
};

export default function SettingsCreditLimit(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [displayInputs, setDisplayInputs] = useState({});
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);
  const complianceConfirmed =
    props.options?.['payment_setting.compliance_confirmed'] === true ||
    props.options?.['payment_setting.compliance_confirmed'] === 'true';
  const quotaDisplayType =
    props.options?.['general_setting.quota_display_type'] ||
    localStorage.getItem('quota_display_type') ||
    'USD';
  const quotaPerUnit = useMemo(() => {
    const raw = parseFloat(
      props.options?.QuotaPerUnit ||
        localStorage.getItem('quota_per_unit') ||
        '500000',
    );
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  }, [props.options]);
  const currencyConfig = useMemo(() => {
    const statusStr = localStorage.getItem('status');
    let status = {};
    try {
      status = statusStr ? JSON.parse(statusStr) : {};
    } catch (e) {
      status = {};
    }
    if (quotaDisplayType === 'CNY') {
      const rate = parseFloat(
        props.options?.USDExchangeRate || status?.usd_exchange_rate || '7.3',
      );
      return {
        type: quotaDisplayType,
        symbol: '¥',
        rate: Number.isFinite(rate) && rate > 0 ? rate : 7.3,
      };
    }
    if (quotaDisplayType === 'CUSTOM') {
      const rate = parseFloat(
        props.options?.['general_setting.custom_currency_exchange_rate'] ||
          status?.custom_currency_exchange_rate ||
          '1',
      );
      return {
        type: quotaDisplayType,
        symbol:
          props.options?.['general_setting.custom_currency_symbol'] ||
          status?.custom_currency_symbol ||
          '¤',
        rate: Number.isFinite(rate) && rate > 0 ? rate : 1,
      };
    }
    return {
      type: quotaDisplayType,
      symbol: quotaDisplayType === 'TOKENS' ? '' : '$',
      rate: 1,
    };
  }, [props.options, quotaDisplayType]);
  const quotaInputUnit = useMemo(() => {
    if (quotaDisplayType === 'TOKENS') return 'Token';
    if (quotaDisplayType === 'USD') return 'USD';
    if (quotaDisplayType === 'CNY') return 'CNY';
    return t('自定义货币');
  }, [quotaDisplayType, t]);

  const quotaToDisplayAmount = (quota) => {
    const q = Number(quota || 0);
    if (!Number.isFinite(q) || q === 0) return 0;
    if (quotaDisplayType === 'TOKENS') return q;
    const usd = Math.abs(q) / quotaPerUnit;
    const sign = Math.sign(q);
    if (quotaDisplayType === 'USD') return sign * usd;
    return sign * usd * currencyConfig.rate;
  };

  const displayAmountToQuota = (amount) => {
    const value = Number(amount || 0);
    if (!Number.isFinite(value) || value === 0) return 0;
    if (quotaDisplayType === 'TOKENS') return Math.round(value);
    const sign = Math.sign(value);
    const abs = Math.abs(value);
    const usd = quotaDisplayType === 'USD' ? abs : abs / currencyConfig.rate;
    return sign * Math.round(usd * quotaPerUnit);
  };

  const quotaExtraText = (field, extraText = '') => {
    const rawQuota = Number(inputs[field] || 0);
    const rawText = t('等价原生额度：{{quota}} Token', {
      quota: rawQuota.toLocaleString(),
    });
    return extraText ? `${extraText} · ${rawText}` : rawText;
  };

  const updateQuotaField = (field, amount) => {
    const displayAmount = amount === '' || amount == null ? 0 : amount;
    const quota = displayAmountToQuota(displayAmount);
    setDisplayInputs((prev) => ({
      ...prev,
      [field]: displayAmount,
    }));
    setInputs((prev) => ({
      ...prev,
      [field]: String(quota),
    }));
  };

  const renderQuotaAmountInput = ({ field, label, extraText, placeholder }) => (
    <Form.Slot label={label} style={{ width: '100%' }}>
      <InputNumber
        value={displayInputs[field] ?? quotaToDisplayAmount(inputs[field])}
        step={quotaDisplayType === 'TOKENS' ? 1 : 0.000001}
        min={0}
        precision={quotaDisplayType === 'TOKENS' ? 0 : 6}
        prefix={
          quotaDisplayType === 'TOKENS' ? undefined : currencyConfig.symbol
        }
        suffix={quotaDisplayType === 'TOKENS' ? 'Token' : quotaInputUnit}
        placeholder={placeholder || ''}
        style={{ width: '100%' }}
        onChange={(value) => updateQuotaField(field, value)}
      />
      <Text
        type='tertiary'
        size='small'
        style={{ display: 'block', marginTop: 4 }}
      >
        {quotaExtraText(field, extraText)}
      </Text>
    </Form.Slot>
  );

  const renderRatioInput = ({ field, label, extraText, placeholder }) => (
    <Form.Slot label={label} style={{ width: '100%' }}>
      <InputNumber
        value={Number(inputs[field] || 0)}
        min={0}
        step={0.1}
        precision={4}
        suffix='%'
        placeholder={placeholder || '0'}
        style={{ width: '100%' }}
        onChange={(value) =>
          setInputs((prev) => ({
            ...prev,
            [field]: value === '' || value == null ? 0 : value,
          }))
        }
      />
      {extraText && (
        <Text
          type='tertiary'
          size='small'
          style={{ display: 'block', marginTop: 4 }}
        >
          {extraText}
        </Text>
      )}
    </Form.Slot>
  );

  function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const requestQueue = updateArray.map((item) => {
      let value = '';
      if (typeof inputs[item.key] === 'boolean') {
        value = String(inputs[item.key]);
      } else {
        value = inputs[item.key];
      }
      return API.put('/api/option/', {
        key: item.key,
        value,
      });
    });
    setLoading(true);
    Promise.all(requestQueue)
      .then((res) => {
        if (requestQueue.length === 1) {
          if (res.includes(undefined)) return;
        } else if (requestQueue.length > 1) {
          if (res.includes(undefined))
            return showError(t('部分保存失败，请重试'));
        }
        showSuccess(t('保存成功'));
        props.refresh();
      })
      .catch(() => {
        showError(t('保存失败，请重试'));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    const currentInputs = { ...DEFAULT_INPUTS };
    for (let key in props.options || {}) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_INPUTS, key)) {
        currentInputs[key] = props.options[key];
      }
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    setDisplayInputs(
      QUOTA_FIELDS.reduce((acc, field) => {
        acc[field] = Number(
          quotaToDisplayAmount(currentInputs[field]).toFixed(6),
        );
        return acc;
      }, {}),
    );
    refForm.current?.setValues(currentInputs);
  }, [props.options]);
  return (
    <>
      <Spin spinning={loading}>
        {!complianceConfirmed && (
          <Banner
            type='warning'
            description={t(
              '设置非零邀请奖励额度前，需要先在支付设置中确认合规声明。',
            )}
            closeIcon={null}
            className='!rounded-lg mb-3'
          />
        )}
        <Form
          values={inputs}
          getFormApi={(formAPI) => (refForm.current = formAPI)}
          style={{ marginBottom: 15 }}
        >
          <Form.Section text={t('额度设置')}>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                {renderQuotaAmountInput({
                  field: 'QuotaForNewUser',
                  label: t('新用户初始额度'),
                })}
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                {renderQuotaAmountInput({
                  field: 'PreConsumedQuota',
                  label: t('请求预扣费额度'),
                  extraText: t('请求结束后多退少补'),
                })}
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                {renderQuotaAmountInput({
                  field: 'QuotaForInviter',
                  label: t('邀请新用户奖励额度'),
                  extraText: !complianceConfirmed
                    ? t('非零值需先确认合规声明')
                    : '',
                  placeholder:
                    quotaDisplayType === 'TOKENS'
                      ? t('例如：2000')
                      : t('例如：10'),
                })}
              </Col>
            </Row>
            <Row>
              <Col xs={24} sm={12} md={8} lg={8} xl={6}>
                {renderQuotaAmountInput({
                  field: 'QuotaForInvitee',
                  label: t('新用户使用邀请码奖励额度'),
                  extraText: !complianceConfirmed
                    ? t('非零值需先确认合规声明')
                    : '',
                  placeholder:
                    quotaDisplayType === 'TOKENS'
                      ? t('例如：1000')
                      : t('例如：5'),
                })}
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                {renderRatioInput({
                  field: 'AffFirstTopUpRewardRatio',
                  label: t('邀请用户首次充值返点比例'),
                  extraText: t('按被邀请用户首次成功充值入账额度计算'),
                  placeholder: t('例如：10'),
                })}
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                {renderRatioInput({
                  field: 'AffConsumptionRewardRatio',
                  label: t('邀请用户后续消费返现比例'),
                  extraText: t('按被邀请用户每次实际消费额度计算'),
                  placeholder: t('例如：1'),
                })}
              </Col>
              <Col xs={24} sm={12} md={8} lg={8} xl={8}>
                <Form.Slot label={t('金币汇率')} style={{ width: '100%' }}>
                  <InputNumber
                    value={Number(inputs.GoldQuotaExchangeRate || 1)}
                    min={0.0001}
                    step={0.0001}
                    precision={6}
                    placeholder='1'
                    style={{ width: '100%' }}
                    onChange={(value) =>
                      setInputs((prev) => ({
                        ...prev,
                        GoldQuotaExchangeRate:
                          value === '' || value == null ? 1 : value,
                      }))
                    }
                  />
                  <Text
                    type='tertiary'
                    size='small'
                    style={{ display: 'block', marginTop: 4 }}
                  >
                    {t('每 1 原生额度消耗多少金币，填 1 表示 1:1。')}
                  </Text>
                </Form.Slot>
              </Col>
            </Row>
            <Row>
              <Col span={24}>
                <Text type='tertiary' size='small'>
                  {t('当前按 {{unit}} 输入，保存时自动换算为系统原生额度。', {
                    unit: quotaInputUnit,
                  })}
                </Text>
              </Col>
            </Row>
            <Row>
              <Col>
                <Form.Switch
                  label={t('对免费模型启用预消耗')}
                  field={'quota_setting.enable_free_model_pre_consume'}
                  extraText={t(
                    '开启后，对免费模型（倍率为0，或者价格为0）的模型也会预消耗额度',
                  )}
                  onChange={(value) =>
                    setInputs({
                      ...inputs,
                      'quota_setting.enable_free_model_pre_consume': value,
                    })
                  }
                />
              </Col>
            </Row>

            <Row>
              <Button size='default' onClick={onSubmit}>
                {t('保存额度设置')}
              </Button>
            </Row>
          </Form.Section>
        </Form>
      </Spin>
    </>
  );
}
