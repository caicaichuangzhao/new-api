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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getCurrencyDisplay, getCurrencyLabel } from '@/lib/currency'
import {
  formatGoldQuota,
  formatQuota,
  parseGoldAmountToQuotaUnits,
  parseQuotaFromDollars,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog } from '@/components/dialog'
import { adjustUserQuota } from '../api'
import type { QuotaAccountType, QuotaAdjustMode } from '../types'

interface UserQuotaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number
  currentQuota: number
  currentGoldQuota: number
  onSuccess: () => void
}

export function UserQuotaDialog(props: UserQuotaDialogProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<QuotaAdjustMode>('add')
  const [accountType, setAccountType] = useState<QuotaAccountType>('quota')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)

  const { meta: currencyMeta } = getCurrencyDisplay()
  const currencyLabel = getCurrencyLabel()
  const tokensOnly = currencyMeta.kind === 'tokens'

  const amountValue = parseFloat(amount) || 0
  const quotaValue =
    accountType === 'gold'
      ? parseGoldAmountToQuotaUnits(Math.abs(amountValue))
      : parseQuotaFromDollars(Math.abs(amountValue))

  const formatAccountQuota = (value: number) =>
    accountType === 'gold'
      ? `${formatGoldQuota(Math.max(0, value))} ${t('Gold')}`
      : formatQuota(value)

  const getPreviewText = () => {
    const current =
      accountType === 'gold' ? props.currentGoldQuota : props.currentQuota
    const val = quotaValue
    switch (mode) {
      case 'add':
        return `${t('Current quota')}: ${formatAccountQuota(current)}  +${formatAccountQuota(val)} = ${formatAccountQuota(current + val)}`
      case 'subtract':
        return `${t('Current quota')}: ${formatAccountQuota(current)}  -${formatAccountQuota(val)} = ${formatAccountQuota(current - val)}`
      case 'override': {
        const overrideQuota =
          accountType === 'gold'
            ? parseGoldAmountToQuotaUnits(Math.max(0, amountValue))
            : parseQuotaFromDollars(amountValue)
        return `${t('Current quota')}: ${formatAccountQuota(current)} → ${formatAccountQuota(overrideQuota)}`
      }
      default:
        return ''
    }
  }

  const handleConfirm = async () => {
    if (!amount && mode !== 'override') return
    if (quotaValue <= 0 && mode !== 'override') return

    setLoading(true)
    try {
      const value =
        mode === 'override'
          ? accountType === 'gold'
            ? parseGoldAmountToQuotaUnits(Math.max(0, amountValue))
            : parseQuotaFromDollars(amountValue)
          : quotaValue
      const result = await adjustUserQuota({
        id: props.userId,
        action: 'add_quota',
        mode,
        value: mode === 'override' ? value : Math.abs(value),
        quota_type: accountType,
      })
      if (result.success) {
        toast.success(t('Quota adjusted successfully'))
        setAmount('')
        setMode('add')
        setAccountType('quota')
        props.onOpenChange(false)
        props.onSuccess()
      } else {
        toast.error(result.message || t('Failed to adjust quota'))
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('Failed to adjust quota'))
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setAmount('')
    setMode('add')
    setAccountType('quota')
    props.onOpenChange(false)
  }

  const placeholder =
    accountType === 'gold'
      ? t('Enter gold amount')
      : tokensOnly
        ? t('Enter amount in tokens')
        : t('Enter amount in {{currency}}', { currency: currencyLabel })

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Adjust Quota')}
      description={t('Select an operation mode and enter the amount')}
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button variant='outline' onClick={handleCancel}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? t('Processing...') : t('Confirm')}
          </Button>
        </>
      }
    >
      <div className='space-y-4'>
        <div className='text-muted-foreground text-sm'>{getPreviewText()}</div>

        <div className='space-y-2'>
          <Label>{t('Account')}</Label>
          <Select
            items={[
              { value: 'quota', label: t('Balance') },
              { value: 'gold', label: t('Gold') },
            ]}
            value={accountType}
            onValueChange={(value) => {
              if (value === 'quota' || value === 'gold') {
                setAccountType(value)
                setAmount('')
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('Select account')} />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                <SelectItem value='quota'>{t('Balance')}</SelectItem>
                <SelectItem value='gold'>{t('Gold')}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-2'>
          <Label>{t('Mode')}</Label>
          <div className='flex gap-1'>
            {(['add', 'subtract', 'override'] as const).map((m) => (
              <Button
                key={m}
                type='button'
                variant='outline'
                size='sm'
                className={cn(
                  mode === m &&
                    'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                )}
                onClick={() => {
                  setMode(m)
                  setAmount('')
                }}
              >
                {m === 'add'
                  ? t('Add')
                  : m === 'subtract'
                    ? t('Subtract')
                    : t('Override')}
              </Button>
            ))}
          </div>
        </div>

        <div className='space-y-2'>
          <Label>
            {accountType === 'gold'
              ? t('Gold Amount')
              : `${t('Amount')} (${currencyLabel})`}
          </Label>
          <Input
            type='number'
            step={tokensOnly ? 1 : 0.000001}
            min={mode === 'override' ? 0 : 0}
            placeholder={placeholder}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirm()
            }}
          />
        </div>
      </div>
    </Dialog>
  )
}
