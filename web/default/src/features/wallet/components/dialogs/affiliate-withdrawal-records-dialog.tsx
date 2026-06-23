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
import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatMoneyQuota, formatTimestampToDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog } from '@/components/dialog'
import { StatusBadge } from '@/components/status-badge'
import {
  cancelAffiliateWithdrawal,
  getAffiliateWithdrawals,
  isApiSuccess,
} from '../../api'
import { getAffiliateWithdrawalStatusConfig } from '../../lib/affiliate-withdrawals'
import type { AffiliateWithdrawalRecord } from '../../types'

type AffiliateWithdrawalRecordsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged?: () => void | Promise<void>
}

const PAGE_SIZE = 10

export function AffiliateWithdrawalRecordsDialog({
  open,
  onOpenChange,
  onChanged,
}: AffiliateWithdrawalRecordsDialogProps) {
  const { t } = useTranslation()
  const [records, setRecords] = useState<AffiliateWithdrawalRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [cancellingId, setCancellingId] = useState<number | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const fetchRecords = useCallback(async () => {
    if (!open) return
    setLoading(true)
    try {
      const response = await getAffiliateWithdrawals(page, PAGE_SIZE)
      if (isApiSuccess(response) && response.data) {
        setRecords(response.data.items || [])
        setTotal(response.data.total || 0)
      } else {
        setRecords([])
        setTotal(0)
        toast.error(response.message || t('Failed to load withdrawal records'))
      }
    } catch (_error) {
      setRecords([])
      setTotal(0)
      toast.error(t('Failed to load withdrawal records'))
    } finally {
      setLoading(false)
    }
  }, [open, page, t])

  useEffect(() => {
    if (open) {
      fetchRecords()
    }
  }, [fetchRecords, open])

  useEffect(() => {
    if (open) {
      setPage(1)
    }
  }, [open])

  const handleCancel = async (id: number) => {
    setCancellingId(id)
    try {
      const response = await cancelAffiliateWithdrawal(id)
      if (isApiSuccess(response)) {
        toast.success(t('Withdrawal request cancelled'))
        await fetchRecords()
        await onChanged?.()
      } else {
        toast.error(
          response.message || t('Failed to cancel withdrawal request')
        )
      }
    } catch (_error) {
      toast.error(t('Failed to cancel withdrawal request'))
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Withdrawal Records')}
      description={t(
        'View affiliate reward withdrawal requests and review status.'
      )}
      contentClassName='flex max-h-[calc(100dvh-2rem)] flex-col max-sm:w-screen max-sm:max-w-none max-sm:rounded-none sm:max-w-3xl'
      contentHeight='auto'
      bodyClassName='flex flex-col gap-3'
    >
      <ScrollArea className='max-h-[min(58vh,560px)] pr-3 sm:pr-4'>
        {loading ? (
          <div className='flex flex-col gap-3'>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className='rounded-lg border p-3'>
                <Skeleton className='h-5 w-36' />
                <Skeleton className='mt-3 h-4 w-56' />
                <Skeleton className='mt-2 h-4 w-40' />
              </div>
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className='text-muted-foreground flex min-h-40 flex-col items-center justify-center text-center'>
            <p className='text-sm font-medium'>{t('No withdrawal records')}</p>
            <p className='mt-1 text-xs'>
              {t('Submitted withdrawal requests will appear here.')}
            </p>
          </div>
        ) : (
          <div className='flex flex-col gap-3'>
            {records.map((record) => {
              const statusConfig = getAffiliateWithdrawalStatusConfig(
                record.status
              )
              return (
                <div key={record.id} className='rounded-lg border p-3'>
                  <div className='flex items-start justify-between gap-3'>
                    <div className='min-w-0'>
                      <div className='font-mono text-sm font-semibold'>
                        #{record.id}
                      </div>
                      <div className='text-muted-foreground mt-1 text-xs'>
                        {formatTimestampToDate(record.created_at)}
                      </div>
                    </div>
                    <StatusBadge
                      label={t(statusConfig.label)}
                      variant={statusConfig.variant}
                      showDot
                      copyable={false}
                    />
                  </div>

                  <div className='mt-3 grid gap-3 text-sm sm:grid-cols-3'>
                    <div>
                      <div className='text-muted-foreground text-xs'>
                        {t('Amount')}
                      </div>
                      <div className='mt-1 font-semibold'>
                        {formatMoneyQuota(record.quota)}
                      </div>
                    </div>
                    <div>
                      <div className='text-muted-foreground text-xs'>
                        {t('Alipay Name')}
                      </div>
                      <div className='mt-1 truncate'>{record.alipay_name}</div>
                    </div>
                    <div>
                      <div className='text-muted-foreground text-xs'>
                        {t('Alipay Account')}
                      </div>
                      <div className='mt-1 truncate font-mono'>
                        {record.alipay_account}
                      </div>
                    </div>
                  </div>

                  {record.reject_reason ? (
                    <p className='text-muted-foreground mt-3 text-xs'>
                      {t('Reject Reason')}: {record.reject_reason}
                    </p>
                  ) : null}

                  {record.status === 'pending' ? (
                    <div className='mt-3 flex justify-end'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handleCancel(record.id)}
                        disabled={cancellingId === record.id}
                      >
                        {cancellingId === record.id && (
                          <Loader2 className='animate-spin' />
                        )}
                        {t('Cancel Request')}
                      </Button>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>

      {!loading && records.length > 0 ? (
        <div className='flex items-center justify-between border-t pt-3'>
          <div className='text-muted-foreground text-xs'>
            {t('Showing')} {(page - 1) * PAGE_SIZE + 1}-
            {Math.min(page * PAGE_SIZE, total)} {t('of')} {total}
          </div>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              className='h-8 w-8 p-0'
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className='h-4 w-4' />
            </Button>
            <span className='text-muted-foreground text-sm'>
              {page} / {totalPages}
            </span>
            <Button
              variant='outline'
              size='sm'
              className='h-8 w-8 p-0'
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page >= totalPages}
            >
              <ChevronRight className='h-4 w-4' />
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  )
}
