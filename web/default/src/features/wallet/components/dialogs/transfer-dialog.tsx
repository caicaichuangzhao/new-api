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
import { useState, useEffect, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  formatMoneyQuota,
  parseMoneyAmountToQuotaUnits,
  quotaUnitsToMoneyAmount,
} from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Dialog } from '@/components/dialog'
import { QUOTA_PER_DOLLAR } from '../../constants'

interface TransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (amount: number) => Promise<boolean>
  availableQuota: number
  transferring: boolean
}

export function TransferDialog({
  open,
  onOpenChange,
  onConfirm,
  availableQuota,
  transferring,
}: TransferDialogProps) {
  const { t } = useTranslation()
  const minimumAmount = quotaUnitsToMoneyAmount(QUOTA_PER_DOLLAR)
  const availableAmount = quotaUnitsToMoneyAmount(availableQuota)
  const [amount, setAmount] = useState(minimumAmount)
  const quota = useMemo(
    () => parseMoneyAmountToQuotaUnits(amount),
    [amount]
  )
  const canSubmit = quota >= QUOTA_PER_DOLLAR && quota <= availableQuota

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAmount(minimumAmount)
    }
  }, [minimumAmount, open])

  const handleConfirm = async () => {
    if (!canSubmit) return
    const success = await onConfirm(quota)
    if (success) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Transfer Rewards')}
      description={t('Move affiliate rewards to your main balance')}
      contentClassName='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-md'
      titleClassName='text-xl font-semibold'
      footerClassName='grid grid-cols-2 gap-2 sm:flex'
      contentHeight='auto'
      bodyClassName='flex flex-col gap-4'
      footer={
        <>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={transferring}
          >
            {t('Cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit || transferring}>
            {transferring && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {t('Transfer')}
          </Button>
        </>
      }
    >
      <FieldGroup className='py-3 sm:py-4'>
        <Field>
          <FieldLabel>
            {t('Available Rewards')}
          </FieldLabel>
          <div className='text-2xl font-semibold'>
            {formatMoneyQuota(availableQuota)}
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor='transfer-amount'>
            {t('Transfer Amount')}
          </FieldLabel>
          <Input
            id='transfer-amount'
            type='number'
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            min={minimumAmount}
            max={availableAmount}
            step={0.01}
            className='font-mono text-lg'
          />
          <FieldDescription>
            {t('Minimum:')} {formatMoneyQuota(QUOTA_PER_DOLLAR)}
          </FieldDescription>
        </Field>
      </FieldGroup>
    </Dialog>
  )
}
