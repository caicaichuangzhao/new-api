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
import * as z from 'zod'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import type { CurrencyDisplayType } from '@/stores/system-config-store'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { FormDirtyIndicator } from '../components/form-dirty-indicator'
import { FormNavigationGuard } from '../components/form-navigation-guard'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
  SettingsFormGrid,
  SettingsFormGridItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useSettingsForm } from '../hooks/use-settings-form'
import { useUpdateOption } from '../hooks/use-update-option'

const quotaSchema = z.object({
  QuotaForNewUser: z.coerce.number().min(0),
  PreConsumedQuota: z.coerce.number().min(0),
  QuotaForInviter: z.coerce.number().min(0),
  QuotaForInvitee: z.coerce.number().min(0),
  AffFirstTopUpRewardRatio: z.coerce.number().min(0),
  AffConsumptionRewardRatio: z.coerce.number().min(0),
  TopUpLink: z.string(),
  general_setting: z.object({
    docs_link: z.string(),
  }),
  quota_setting: z.object({
    enable_free_model_pre_consume: z.boolean(),
  }),
})

type QuotaFormValues = z.infer<typeof quotaSchema>
type QuotaFieldName =
  | 'QuotaForNewUser'
  | 'PreConsumedQuota'
  | 'QuotaForInviter'
  | 'QuotaForInvitee'

type PercentFieldName = 'AffFirstTopUpRewardRatio' | 'AffConsumptionRewardRatio'

type QuotaCurrencyConfig = {
  quotaDisplayType: CurrencyDisplayType
  quotaPerUnit: number | string
  usdExchangeRate: number | string
  customCurrencySymbol: string
  customCurrencyExchangeRate: number | string
}

type QuotaSettingsSectionProps = {
  defaultValues: QuotaFormValues
  complianceConfirmed?: boolean
  currencyConfig: QuotaCurrencyConfig
}

function normalizePositiveNumber(value: number | string, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function getEffectiveCurrencyConfig(config: QuotaCurrencyConfig) {
  return {
    ...config,
    quotaPerUnit: normalizePositiveNumber(config.quotaPerUnit, 500000),
    usdExchangeRate: normalizePositiveNumber(config.usdExchangeRate, 1),
    customCurrencyExchangeRate: normalizePositiveNumber(
      config.customCurrencyExchangeRate,
      1
    ),
    customCurrencySymbol: config.customCurrencySymbol?.trim() || '¤',
  }
}

function quotaToDisplayAmount(quota: number, config: QuotaCurrencyConfig) {
  const effective = getEffectiveCurrencyConfig(config)
  if (!Number.isFinite(quota) || quota === 0) return 0
  if (effective.quotaDisplayType === 'TOKENS') return quota

  const usdAmount = Math.abs(quota) / effective.quotaPerUnit
  const sign = Math.sign(quota)

  if (effective.quotaDisplayType === 'USD') return sign * usdAmount
  if (effective.quotaDisplayType === 'CNY') {
    return sign * usdAmount * effective.usdExchangeRate
  }

  return sign * usdAmount * effective.customCurrencyExchangeRate
}

function displayAmountToQuota(amount: number, config: QuotaCurrencyConfig) {
  const effective = getEffectiveCurrencyConfig(config)
  if (!Number.isFinite(amount) || amount === 0) return 0
  if (effective.quotaDisplayType === 'TOKENS') return Math.round(amount)

  const sign = Math.sign(amount)
  const absAmount = Math.abs(amount)
  const usdAmount =
    effective.quotaDisplayType === 'USD'
      ? absAmount
      : absAmount /
        (effective.quotaDisplayType === 'CNY'
          ? effective.usdExchangeRate
          : effective.customCurrencyExchangeRate)

  return sign * Math.round(usdAmount * effective.quotaPerUnit)
}

function getQuotaInputUnit(
  config: QuotaCurrencyConfig,
  t: (key: string) => string
) {
  const effective = getEffectiveCurrencyConfig(config)

  switch (effective.quotaDisplayType) {
    case 'TOKENS':
      return t('Token')
    case 'CNY':
      return t('CNY')
    case 'CUSTOM':
      return effective.customCurrencySymbol
    case 'USD':
    default:
      return t('USD')
  }
}

function formatRawQuota(value: number | string | null | undefined) {
  const raw = Number(value || 0)
  return Number.isFinite(raw) ? raw.toLocaleString() : '0'
}

export function QuotaSettingsSection({
  defaultValues,
  complianceConfirmed = true,
  currencyConfig,
}: QuotaSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const quotaInputUnit = getQuotaInputUnit(currencyConfig, t)
  const quotaInputStep =
    currencyConfig.quotaDisplayType === 'TOKENS' ? '1' : '0.000001'

  const { form, handleSubmit, isDirty, isSubmitting } =
    useSettingsForm<QuotaFormValues>({
      resolver: zodResolver(quotaSchema) as Resolver<
        QuotaFormValues,
        unknown,
        QuotaFormValues
      >,
      defaultValues,
      onSubmit: async (_data, changedFields) => {
        for (const [key, value] of Object.entries(changedFields)) {
          await updateOption.mutateAsync({
            key,
            value: value as string | number | boolean,
          })
        }
      },
    })

  const renderQuotaField = (
    name: QuotaFieldName,
    label: string,
    description: string
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => {
        const displayValue = quotaToDisplayAmount(
          Number(field.value || 0),
          currencyConfig
        )

        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              <div className='relative'>
                <Input
                  type='number'
                  min={0}
                  step={quotaInputStep}
                  value={Number(displayValue.toFixed(6))}
                  onChange={(event) => {
                    if (event.target.value === '') {
                      field.onChange(0)
                      return
                    }

                    const next = event.currentTarget.valueAsNumber
                    if (Number.isFinite(next)) {
                      field.onChange(displayAmountToQuota(next, currencyConfig))
                    }
                  }}
                  name={field.name}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  className='pr-24'
                />
                <span className='text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-medium'>
                  {quotaInputUnit}
                </span>
              </div>
            </FormControl>
            <FormDescription>
              {description}
              <span className='block'>
                {t('Equivalent raw quota: {{quota}} Token', {
                  quota: formatRawQuota(field.value),
                })}
              </span>
            </FormDescription>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )

  const renderPercentField = (
    name: PercentFieldName,
    label: string,
    description: string
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className='relative'>
              <Input
                type='number'
                min={0}
                step='0.01'
                value={field.value ?? 0}
                onChange={(event) => {
                  if (event.target.value === '') {
                    field.onChange(0)
                    return
                  }
                  const next = event.currentTarget.valueAsNumber
                  if (Number.isFinite(next)) {
                    field.onChange(next)
                  }
                }}
                name={field.name}
                onBlur={field.onBlur}
                ref={field.ref}
                className='pr-10'
              />
              <span className='text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-medium'>
                %
              </span>
            </div>
          </FormControl>
          <FormDescription>{description}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <SettingsSection title={t('Quota Settings')}>
      <FormNavigationGuard when={isDirty} />

      {!complianceConfirmed ? (
        <Alert variant='destructive'>
          <AlertDescription>
            {t(
              'Non-zero invitation rewards require compliance confirmation in Payment Gateway settings.'
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      <Form {...form}>
        <SettingsForm onSubmit={handleSubmit}>
          <SettingsPageFormActions
            onSave={handleSubmit}
            isSaving={updateOption.isPending || isSubmitting}
          />
          <FormDirtyIndicator isDirty={isDirty} />
          <SettingsFormGrid>
            {renderQuotaField(
              'QuotaForNewUser',
              t('New User Quota'),
              t('Initial quota given to new users')
            )}

            {renderQuotaField(
              'PreConsumedQuota',
              t('Pre-Consumed Quota'),
              t('Quota consumed before charging users')
            )}

            {renderQuotaField(
              'QuotaForInviter',
              t('Inviter Reward'),
              t('Quota given to users who invite others')
            )}

            {renderQuotaField(
              'QuotaForInvitee',
              t('Invitee Reward'),
              t('Quota given to invited users')
            )}

            {renderPercentField(
              'AffFirstTopUpRewardRatio',
              t('First Top-Up Referral Rebate'),
              t(
                "Calculated from the credited quota of an invited user's first successful top-up."
              )
            )}

            {renderPercentField(
              'AffConsumptionRewardRatio',
              t('Referral Consumption Cashback'),
              t(
                'Calculated from each settled quota consumption by invited users.'
              )
            )}

            <SettingsFormGridItem span='full'>
              <p className='text-muted-foreground text-sm'>
                {t('Values are entered as {{unit}} and saved as raw quota.', {
                  unit: quotaInputUnit,
                })}
              </p>
            </SettingsFormGridItem>

            <SettingsFormGridItem span='full'>
              <FormField
                control={form.control}
                name='quota_setting.enable_free_model_pre_consume'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>{t('Pre-Consume for Free Models')}</FormLabel>
                      <FormDescription>
                        {t(
                          'When enabled, zero-cost models also pre-consume quota before final settlement.'
                        )}
                      </FormDescription>
                    </SettingsSwitchContent>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={updateOption.isPending}
                      />
                    </FormControl>
                  </SettingsSwitchItem>
                )}
              />
            </SettingsFormGridItem>

            <FormField
              control={form.control}
              name='TopUpLink'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Top-Up Link')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('https://example.com/topup')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('External link for users to purchase quota')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='general_setting.docs_link'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Documentation Link')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('https://docs.example.com')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Link to your documentation site')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsFormGrid>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
