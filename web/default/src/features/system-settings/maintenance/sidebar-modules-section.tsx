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
import { useEffect, useMemo } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  type CustomNavigationLink,
  createCustomNavigationLink,
  normalizeCustomNavigationLinks,
} from '@/lib/custom-navigation'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormLabel,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  SettingsControlChildren,
  SettingsForm,
  SettingsSwitchContent,
  SettingsControlGroup,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  SIDEBAR_MODULES_DEFAULT,
  type SidebarModulesAdminConfig,
  serializeSidebarModulesAdmin,
} from './config'

type SidebarModulesSectionProps = {
  config: SidebarModulesAdminConfig
  initialSerialized: string
}

type SidebarFormValues = SidebarModulesAdminConfig & {
  console: SidebarModulesAdminConfig[string] & {
    customItems: CustomNavigationLink[]
  }
}

const toTitleCase = (value: string) =>
  value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())

export function SidebarModulesSection({
  config,
  initialSerialized,
}: SidebarModulesSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const sectionMeta: Record<string, { title: string; description: string }> = {
    chat: {
      title: t('Chat area'),
      description: t('Playground experiments and live conversations.'),
    },
    console: {
      title: t('Console area'),
      description: t('Dashboards, tokens, and usage analytics.'),
    },
    personal: {
      title: t('Personal area'),
      description: t('Wallet management and personal preferences.'),
    },
    admin: {
      title: t('Admin area'),
      description: t('Global configuration and administrative tools.'),
    },
  }

  const moduleMeta: Record<
    string,
    Record<string, { title: string; description: string }>
  > = {
    chat: {
      playground: {
        title: t('Playground'),
        description: t('Experiment with prompts and models in real time.'),
      },
      chat: {
        title: t('Chat'),
        description: t('Access previous conversations and start new ones.'),
      },
      chatroom: {
        title: t('Chatroom'),
        description: t('Future user community and real-time discussion space.'),
      },
    },
    console: {
      detail: {
        title: t('Dashboard'),
        description: t('Aggregated usage metrics and trend charts.'),
      },
      token: {
        title: t('Token management'),
        description: t('Create, revoke, and audit API tokens.'),
      },
      log: {
        title: t('Usage logs'),
        description: t('Detailed request logs for investigations.'),
      },
      midjourney: {
        title: t('Drawing logs'),
        description: t('History of Midjourney-style image tasks.'),
      },
      task: {
        title: t('Task logs'),
        description: t('Background job tracker for queued work.'),
      },
      infinite_canvas: {
        title: t('Infinite Canvas'),
        description: t('Create and organize ideas on an unlimited canvas.'),
      },
    },
    personal: {
      topup: {
        title: t('Wallet'),
        description: t('Top up balance and view billing history.'),
      },
      personal: {
        title: t('Profile'),
        description: t('Personal settings and profile management.'),
      },
    },
    admin: {
      channel: {
        title: t('Channels'),
        description: t('Configure upstream providers and routing.'),
      },
      models: {
        title: t('Models'),
        description: t('Manage catalog visibility and pricing.'),
      },
      redemption: {
        title: t('Redeem codes'),
        description: t('Create and review invite or credit codes.'),
      },
      user: {
        title: t('Users'),
        description: t('Administer user accounts and roles.'),
      },
      setting: {
        title: t('System settings'),
        description: t('Advanced platform configuration.'),
      },
      subscription: {
        title: t('Subscription Management'),
        description: t('Manage subscription plans and pricing.'),
      },
    },
  }
  const formDefaults = useMemo<SidebarFormValues>(
    () =>
      ({
        ...config,
        console: {
          ...config.console,
          customItems: normalizeCustomNavigationLinks(
            config.console?.customItems
          ),
        },
      }) as SidebarFormValues,
    [config]
  )

  const form = useForm<SidebarFormValues>({
    defaultValues: formDefaults,
  })
  const consoleCustomItems = useFieldArray<
    SidebarFormValues,
    'console.customItems'
  >({
    control: form.control,
    name: 'console.customItems',
  })

  useEffect(() => {
    form.reset(formDefaults)
  }, [formDefaults, form])

  const onSubmit = async (values: SidebarFormValues) => {
    const payload: SidebarModulesAdminConfig = {
      ...values,
      console: {
        ...values.console,
        customItems: normalizeCustomNavigationLinks(
          values.console?.customItems
        ),
      },
    }
    const serialized = serializeSidebarModulesAdmin(payload)
    if (serialized === initialSerialized) {
      return
    }

    await updateOption.mutateAsync({
      key: 'SidebarModulesAdmin',
      value: serialized,
    })
  }

  const resetToDefault = () => {
    form.reset(SIDEBAR_MODULES_DEFAULT)
  }

  const addConsoleCustomItem = () => {
    consoleCustomItems.append(createCustomNavigationLink())
  }

  const sections = Object.entries(config)

  return (
    <SettingsSection title={t('Sidebar modules')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            onReset={resetToDefault}
            isSaving={updateOption.isPending}
            resetLabel='Reset to default'
            saveLabel='Save sidebar modules'
          />
          {sections.map(([sectionKey, sectionConfig]) => {
            const sectionInfo = sectionMeta[sectionKey] ?? {
              title: toTitleCase(sectionKey),
              description: t('Custom sidebar section'),
            }
            const modules = Object.entries(sectionConfig).filter(
              ([moduleKey]) =>
                moduleKey !== 'enabled' && moduleKey !== 'customItems'
            )

            return (
              <SettingsControlGroup key={sectionKey}>
                <FormField
                  control={form.control}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  name={`${sectionKey}.enabled` as any}
                  render={({ field }) => (
                    <SettingsSwitchItem>
                      <SettingsSwitchContent>
                        <FormLabel>{sectionInfo.title}</FormLabel>
                        <FormDescription>
                          {sectionInfo.description}
                        </FormDescription>
                      </SettingsSwitchContent>
                      <FormControl>
                        <Switch
                          checked={Boolean(field.value)}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </SettingsSwitchItem>
                  )}
                />

                <SettingsControlChildren className='grid gap-3 md:grid-cols-2'>
                  {modules.map(([moduleKey]) => {
                    const moduleInfo = moduleMeta[sectionKey]?.[moduleKey] ?? {
                      title: toTitleCase(moduleKey),
                      description: t('Custom module'),
                    }
                    return (
                      <FormField
                        key={`${sectionKey}.${moduleKey}`}
                        control={form.control}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        name={`${sectionKey}.${moduleKey}` as any}
                        render={({ field }) => (
                          <SettingsSwitchItem className='border-b-0 py-2'>
                            <SettingsSwitchContent>
                              <FormLabel>{moduleInfo.title}</FormLabel>
                              <FormDescription>
                                {moduleInfo.description}
                              </FormDescription>
                            </SettingsSwitchContent>
                            <FormControl>
                              <Switch
                                checked={Boolean(field.value)}
                                onCheckedChange={field.onChange}
                                disabled={
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                  !form.watch(`${sectionKey}.enabled` as any)
                                }
                              />
                            </FormControl>
                          </SettingsSwitchItem>
                        )}
                      />
                    )
                  })}
                  {sectionKey === 'console' ? (
                    <div className='md:col-span-2'>
                      <div className='flex items-center justify-between gap-3 border-t pt-3'>
                        <div className='min-w-0'>
                          <p className='text-sm font-medium'>
                            {t('Custom console links')}
                          </p>
                          <p className='text-muted-foreground text-xs'>
                            {t(
                              'Add multiple sidebar modules that display linked websites inside the site.'
                            )}
                          </p>
                        </div>
                        <Button
                          type='button'
                          variant='outline'
                          onClick={addConsoleCustomItem}
                          disabled={
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            !form.watch(`${sectionKey}.enabled` as any)
                          }
                        >
                          <Plus />
                          {t('Add link')}
                        </Button>
                      </div>

                      <div className='mt-3 flex flex-col gap-3'>
                        {consoleCustomItems.fields.length === 0 ? (
                          <p className='text-muted-foreground rounded-lg border border-dashed px-3 py-3 text-sm'>
                            {t('No custom links yet.')}
                          </p>
                        ) : (
                          consoleCustomItems.fields.map((field, index) => (
                            <div
                              key={field.id}
                              className='grid gap-3 rounded-lg border p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto_auto]'
                            >
                              <FormField
                                control={form.control}
                                name={`console.customItems.${index}.title`}
                                render={({ field }) => (
                                  <div className='flex flex-col gap-1.5'>
                                    <FormLabel>{t('Display name')}</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder={t(
                                          'Third-party marketplace'
                                        )}
                                        {...field}
                                      />
                                    </FormControl>
                                  </div>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`console.customItems.${index}.url`}
                                render={({ field }) => (
                                  <div className='flex flex-col gap-1.5'>
                                    <FormLabel>{t('Link URL')}</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder='https://example.com'
                                        {...field}
                                      />
                                    </FormControl>
                                  </div>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`console.customItems.${index}.enabled`}
                                render={({ field }) => (
                                  <div className='flex items-end justify-between gap-3 lg:flex-col lg:items-center'>
                                    <FormLabel>{t('Enabled')}</FormLabel>
                                    <FormControl>
                                      <Switch
                                        checked={Boolean(field.value)}
                                        onCheckedChange={field.onChange}
                                        disabled={
                                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                          !form.watch(
                                            `${sectionKey}.enabled` as any
                                          )
                                        }
                                      />
                                    </FormControl>
                                  </div>
                                )}
                              />
                              <div className='flex items-end'>
                                <Button
                                  type='button'
                                  variant='outline'
                                  size='icon'
                                  aria-label={t('Remove link')}
                                  onClick={() =>
                                    consoleCustomItems.remove(index)
                                  }
                                >
                                  <Trash2 />
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}
                </SettingsControlChildren>
              </SettingsControlGroup>
            )
          })}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
