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
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Dialog } from '@/components/dialog'
import { StatusBadge } from '@/components/status-badge'
import {
  getAdminAffiliateWithdrawals,
  isApiSuccess,
  reviewAffiliateWithdrawal,
} from '@/features/wallet/api'
import { getAffiliateWithdrawalStatusConfig } from '@/features/wallet/lib/affiliate-withdrawals'
import type {
  AffiliateWithdrawalRecord,
  AffiliateWithdrawalStatus,
} from '@/features/wallet/types'

type AffiliateWithdrawalsAdminDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PAGE_SIZE = 10
const STATUS_OPTIONS: Array<{
  value: AffiliateWithdrawalStatus | 'all'
  label: string
}> = [
  { value: 'pending', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All Statuses' },
]

export function AffiliateWithdrawalsAdminDialog({
  open,
  onOpenChange,
}: AffiliateWithdrawalsAdminDialogProps) {
  const { t } = useTranslation()
  const [records, setRecords] = useState<AffiliateWithdrawalRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<AffiliateWithdrawalStatus | ''>(
    'pending'
  )
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(false)
  const [reviewingId, setReviewingId] = useState<number | null>(null)
  const [rejectRecord, setRejectRecord] =
    useState<AffiliateWithdrawalRecord | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const fetchRecords = useCallback(async () => {
    if (!open) return
    setLoading(true)
    try {
      const response = await getAdminAffiliateWithdrawals({
        page,
        pageSize: PAGE_SIZE,
        status,
        userId: userId.trim(),
      })
      if (isApiSuccess(response) && response.data) {
        setRecords(response.data.items || [])
        setTotal(response.data.total || 0)
      } else {
        setRecords([])
        setTotal(0)
        toast.error(response.message || t('Failed to load withdrawal requests'))
      }
    } catch (_error) {
      setRecords([])
      setTotal(0)
      toast.error(t('Failed to load withdrawal requests'))
    } finally {
      setLoading(false)
    }
  }, [open, page, status, t, userId])

  useEffect(() => {
    if (open) {
      fetchRecords()
    }
  }, [fetchRecords, open])

  useEffect(() => {
    if (open) {
      setPage(1)
    }
  }, [open, status])

  const reviewRecord = async (
    record: AffiliateWithdrawalRecord,
    approved: boolean,
    reason = ''
  ) => {
    setReviewingId(record.id)
    try {
      const response = await reviewAffiliateWithdrawal(record.id, {
        approved,
        reject_reason: reason.trim(),
      })
      if (isApiSuccess(response)) {
        toast.success(
          approved ? t('Withdrawal approved') : t('Withdrawal rejected')
        )
        setRejectRecord(null)
        setRejectReason('')
        await fetchRecords()
      } else {
        toast.error(
          response.message || t('Failed to review withdrawal request')
        )
      }
    } catch (_error) {
      toast.error(t('Failed to review withdrawal request'))
    } finally {
      setReviewingId(null)
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title={t('Withdrawal Review')}
        description={t('Review affiliate reward withdrawal requests.')}
        contentClassName='flex max-h-[calc(100dvh-2rem)] flex-col max-sm:w-screen max-sm:max-w-none max-sm:rounded-none sm:max-w-5xl'
        contentHeight='auto'
        bodyClassName='flex flex-col gap-3'
      >
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
          <Select
            value={status || 'all'}
            onValueChange={(value) => {
              if (value === null) return
              setStatus(
                value === 'all' ? '' : (value as AffiliateWithdrawalStatus)
              )
              setPage(1)
            }}
          >
            <SelectTrigger className='h-9 sm:w-44'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.label)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Input
            value={userId}
            onChange={(event) => {
              setUserId(event.target.value)
              setPage(1)
            }}
            placeholder={t('User ID')}
            className='h-9 sm:w-40'
          />
          <Button
            variant='outline'
            size='sm'
            className='h-9'
            onClick={fetchRecords}
            disabled={loading}
          >
            {t('Search')}
          </Button>
        </div>

        <ScrollArea className='max-h-[min(58vh,560px)] pr-3 sm:pr-4'>
          {loading ? (
            <div className='flex flex-col gap-3'>
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className='rounded-lg border p-3'>
                  <Skeleton className='h-5 w-40' />
                  <Skeleton className='mt-3 h-4 w-72' />
                  <Skeleton className='mt-2 h-4 w-56' />
                </div>
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className='text-muted-foreground flex min-h-44 flex-col items-center justify-center text-center'>
              <p className='text-sm font-medium'>
                {t('No withdrawal requests')}
              </p>
              <p className='mt-1 text-xs'>
                {t('Withdrawal requests submitted by users will appear here.')}
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
                    <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                      <div className='min-w-0'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <span className='font-mono text-sm font-semibold'>
                            #{record.id}
                          </span>
                          <StatusBadge
                            label={t(statusConfig.label)}
                            variant={statusConfig.variant}
                            showDot
                            copyable={false}
                          />
                        </div>
                        <div className='text-muted-foreground mt-1 text-xs'>
                          {formatTimestampToDate(record.created_at)}
                        </div>
                      </div>

                      {record.status === 'pending' ? (
                        <div className='flex shrink-0 gap-2'>
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => reviewRecord(record, true)}
                            disabled={reviewingId === record.id}
                          >
                            {reviewingId === record.id && (
                              <Loader2 className='animate-spin' />
                            )}
                            {t('Approve')}
                          </Button>
                          <Button
                            size='sm'
                            variant='destructive'
                            onClick={() => {
                              setRejectRecord(record)
                              setRejectReason('')
                            }}
                            disabled={reviewingId === record.id}
                          >
                            {t('Reject')}
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    <div className='mt-3 grid gap-3 text-sm sm:grid-cols-5'>
                      <div>
                        <div className='text-muted-foreground text-xs'>
                          {t('User')}
                        </div>
                        <div className='mt-1 truncate'>
                          {record.username || '-'}
                        </div>
                        <div className='text-muted-foreground mt-0.5 font-mono text-xs'>
                          ID: {record.user_id}
                        </div>
                      </div>
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
                        <div className='mt-1 truncate'>
                          {record.alipay_name}
                        </div>
                      </div>
                      <div>
                        <div className='text-muted-foreground text-xs'>
                          {t('Alipay Account')}
                        </div>
                        <div className='mt-1 truncate font-mono'>
                          {record.alipay_account}
                        </div>
                      </div>
                      <div>
                        <div className='text-muted-foreground text-xs'>
                          {t('Reviewer')}
                        </div>
                        <div className='mt-1 truncate'>
                          {record.reviewer_name || '-'}
                        </div>
                        {record.reviewed_at ? (
                          <div className='text-muted-foreground mt-0.5 text-xs'>
                            {formatTimestampToDate(record.reviewed_at)}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {record.reject_reason ? (
                      <p className='text-muted-foreground mt-3 text-xs'>
                        {t('Reject Reason')}: {record.reject_reason}
                      </p>
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

      <ConfirmDialog
        open={!!rejectRecord}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setRejectRecord(null)
        }}
        title={t('Reject Withdrawal Request')}
        desc={t('Enter a reason for rejecting this withdrawal request.')}
        confirmText={reviewingId ? t('Processing...') : t('Reject')}
        destructive
        isLoading={reviewingId === rejectRecord?.id}
        handleConfirm={() => {
          if (rejectRecord) {
            reviewRecord(rejectRecord, false, rejectReason)
          }
        }}
      >
        <Textarea
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
          placeholder={t('Reject reason')}
          disabled={reviewingId === rejectRecord?.id}
        />
      </ConfirmDialog>
    </>
  )
}
