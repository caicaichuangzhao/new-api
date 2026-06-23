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
import { ArrowRightLeft, ListChecks, Share2, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatQuota } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { CopyButton } from '@/components/copy-button'
import type { TopupInfo, UserWalletData } from '../types'

interface AffiliateRewardsCardProps {
  user: UserWalletData | null
  topupInfo: TopupInfo | null
  affiliateLink: string
  onTransfer: () => void
  onWithdraw: () => void
  onViewWithdrawals: () => void
  complianceConfirmed?: boolean
  loading?: boolean
}

export function AffiliateRewardsCard({
  user,
  topupInfo,
  affiliateLink,
  onTransfer,
  onWithdraw,
  onViewWithdrawals,
  complianceConfirmed = true,
  loading,
}: AffiliateRewardsCardProps) {
  const { t } = useTranslation()
  if (loading) {
    return (
      <Card className='bg-muted/20 py-0'>
        <CardContent className='grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,0.72fr)_minmax(320px,1.15fr)] lg:items-center'>
          <div>
            <Skeleton className='h-5 w-32' />
            <Skeleton className='mt-2 h-4 w-48' />
          </div>
          <Skeleton className='h-14 rounded-lg' />
          <Skeleton className='h-10 rounded-lg' />
        </CardContent>
      </Card>
    )
  }

  const hasRewards = (user?.aff_quota ?? 0) > 0
  const firstTopupRatio = Number(topupInfo?.aff_first_topup_reward_ratio ?? 0)
  const consumptionRatio = Number(topupInfo?.aff_consumption_reward_ratio ?? 0)
  const formatRewardRatio = (ratio: number) => {
    if (!Number.isFinite(ratio) || ratio <= 0) return t('Disabled')
    return `${new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 4,
    }).format(ratio)}%`
  }
  const activeRewardParts = [
    firstTopupRatio > 0
      ? t('First top-up earns {{ratio}}', {
          ratio: formatRewardRatio(firstTopupRatio),
        })
      : null,
    consumptionRatio > 0
      ? t('eligible later spending returns {{ratio}}', {
          ratio: formatRewardRatio(consumptionRatio),
        })
      : null,
  ].filter(Boolean)
  const rewardSummary = !topupInfo
    ? t(
        'Earn rewards when your referrals add funds. Transfer accumulated rewards to your balance anytime.'
      )
    : activeRewardParts.length > 0
      ? `${t('Invite friends')}: ${activeRewardParts.join(' · ')}`
      : t('Referral rewards are currently disabled.')

  return (
    <Card className='bg-muted/20 py-0'>
      <CardContent className='grid gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[minmax(200px,1fr)_minmax(180px,0.65fr)_minmax(340px,1.15fr)] lg:items-center'>
        <div className='flex min-w-0 items-center gap-2.5'>
          <div className='bg-background flex size-8 shrink-0 items-center justify-center rounded-lg border'>
            <Share2 className='text-muted-foreground size-4' />
          </div>
          <div className='min-w-0'>
            <h3 className='truncate text-sm font-semibold'>
              {t('Referral Program')}
            </h3>
            <p className='text-muted-foreground line-clamp-2 text-xs'>
              {rewardSummary}
            </p>
          </div>
        </div>

        <div className='grid grid-cols-3 gap-1.5 text-center'>
          {[
            [t('Pending'), formatQuota(user?.aff_quota ?? 0)],
            [t('Total Earned'), formatQuota(user?.aff_history_quota ?? 0)],
            [t('Invites'), String(user?.aff_count ?? 0)],
          ].map(([label, value]) => (
            <div key={label}>
              <div className='text-muted-foreground truncate text-[10px] font-medium tracking-wider uppercase'>
                {label}
              </div>
              <div className='mt-0.5 truncate text-sm font-semibold tabular-nums'>
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className='flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center'>
          <Input
            value={affiliateLink}
            readOnly
            className='border-muted bg-background/70 h-9 min-w-0 flex-1 font-mono text-xs'
          />
          <div className='flex shrink-0 flex-wrap items-center gap-2'>
            <CopyButton
              value={affiliateLink}
              variant='outline'
              className='bg-background size-9 shrink-0'
              iconClassName='size-4'
              tooltip={t('Copy referral link')}
              aria-label={t('Copy referral link')}
            />
            {hasRewards && (
              <Button
                onClick={onTransfer}
                disabled={!complianceConfirmed}
                className='h-9 shrink-0 px-3'
                size='sm'
                variant='outline'
              >
                <ArrowRightLeft />
                {t('Transfer')}
              </Button>
            )}
            {hasRewards && (
              <Button
                onClick={onWithdraw}
                disabled={!complianceConfirmed}
                className='h-9 shrink-0 px-3'
                size='sm'
              >
                <WalletCards />
                {t('Withdraw')}
              </Button>
            )}
            <Button
              onClick={onViewWithdrawals}
              className='h-9 shrink-0 px-3'
              size='sm'
              variant='outline'
            >
              <ListChecks />
              {t('Records')}
            </Button>
          </div>
        </div>
        {!complianceConfirmed ? (
          <p className='text-muted-foreground text-xs lg:col-span-3'>
            {t(
              'Referral reward transfer is disabled until the administrator confirms compliance terms.'
            )}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
