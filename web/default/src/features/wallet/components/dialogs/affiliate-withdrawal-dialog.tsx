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
import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatQuota } from '@/lib/format'
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
import type { AffiliateWithdrawalRequest } from '../../types'

type AffiliateWithdrawalDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  availableQuota: number
  submitting: boolean
  onConfirm: (payload: AffiliateWithdrawalRequest) => Promise<boolean>
}

export function AffiliateWithdrawalDialog({
  open,
  onOpenChange,
  availableQuota,
  submitting,
  onConfirm,
}: AffiliateWithdrawalDialogProps) {
  const { t } = useTranslation()
  const defaultQuota = useMemo(
    () => Math.min(Math.max(availableQuota, 0), QUOTA_PER_DOLLAR),
    [availableQuota]
  )
  const [alipayName, setAlipayName] = useState('')
  const [alipayAccount, setAlipayAccount] = useState('')
  const [quota, setQuota] = useState(defaultQuota)

  useEffect(() => {
    if (open) {
      setAlipayName('')
      setAlipayAccount('')
      setQuota(defaultQuota)
    }
  }, [defaultQuota, open])

  const canSubmit =
    alipayName.trim() !== '' &&
    alipayAccount.trim() !== '' &&
    quota >= QUOTA_PER_DOLLAR &&
    quota <= availableQuota

  const handleConfirm = async () => {
    if (!canSubmit) return
    const success = await onConfirm({
      alipay_name: alipayName.trim(),
      alipay_account: alipayAccount.trim(),
      quota,
    })
    if (success) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Withdraw Rewards')}
      description={t(
        'Submit your Alipay collection information for administrator review.'
      )}
      contentClassName='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-md'
      titleClassName='text-xl font-semibold'
      footerClassName='grid grid-cols-2 gap-2 sm:flex'
      contentHeight='auto'
      footer={
        <>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t('Cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit || submitting}>
            {submitting && <Loader2 className='animate-spin' />}
            {t('Submit')}
          </Button>
        </>
      }
    >
      <FieldGroup className='py-3 sm:py-4'>
        <Field>
          <FieldLabel htmlFor='affiliate-withdrawal-name'>
            {t('Alipay Name')}
          </FieldLabel>
          <Input
            id='affiliate-withdrawal-name'
            value={alipayName}
            onChange={(event) => setAlipayName(event.target.value)}
            disabled={submitting}
            autoComplete='name'
          />
        </Field>

        <Field>
          <FieldLabel htmlFor='affiliate-withdrawal-account'>
            {t('Alipay Account')}
          </FieldLabel>
          <Input
            id='affiliate-withdrawal-account'
            value={alipayAccount}
            onChange={(event) => setAlipayAccount(event.target.value)}
            disabled={submitting}
            autoComplete='email'
          />
        </Field>

        <Field>
          <FieldLabel htmlFor='affiliate-withdrawal-quota'>
            {t('Withdrawal Amount')}
          </FieldLabel>
          <Input
            id='affiliate-withdrawal-quota'
            type='number'
            min={QUOTA_PER_DOLLAR}
            max={availableQuota}
            step={QUOTA_PER_DOLLAR}
            value={quota}
            onChange={(event) => setQuota(Number(event.target.value))}
            disabled={submitting}
            className='font-mono'
          />
          <FieldDescription>
            {t('Available: {{amount}}', {
              amount: formatQuota(availableQuota),
            })}
            {' · '}
            {t('Minimum: {{amount}}', {
              amount: formatQuota(QUOTA_PER_DOLLAR),
            })}
          </FieldDescription>
        </Field>
      </FieldGroup>
    </Dialog>
  )
}
