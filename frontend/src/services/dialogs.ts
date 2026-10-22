import { nextTick, reactive, shallowRef } from 'vue'

type DialogResult = { isConfirmed: boolean; isDismissed: boolean; dismiss?: string; value?: any }
type DialogOptions = Record<string, any>
type ActiveDialog = { options: DialogOptions; resolve: (result: DialogResult) => void }

export const activeDialog = shallowRef<ActiveDialog | null>(null)
export const dialogUi = reactive({ validation: '', loading: false, inputValue: '' as any })
export let htmlContainer: HTMLElement | null = null
let timer: ReturnType<typeof setTimeout> | undefined

export function setHtmlContainer(element: HTMLElement | null) { htmlContainer = element }

function settle(result: DialogResult) {
  if (timer) clearTimeout(timer)
  timer = undefined
  const current = activeDialog.value
  activeDialog.value = null
  current?.resolve(result)
}

function normalize(titleOrOptions: DialogOptions | string, text?: string, icon?: string): DialogOptions {
  return typeof titleOrOptions === 'string' ? { title: titleOrOptions, text, icon } : titleOrOptions
}

function fire(titleOrOptions: DialogOptions | string, text?: string, icon?: string): Promise<DialogResult> {
  const options = normalize(titleOrOptions, text, icon)
  if (activeDialog.value) settle({ isConfirmed: false, isDismissed: true, dismiss: 'close' })
  dialogUi.validation = ''
  dialogUi.loading = false
  dialogUi.inputValue = options.inputValue ?? ''
  const promise = new Promise<DialogResult>(resolve => { activeDialog.value = { options, resolve } })
  void nextTick(() => options.didOpen?.())
  if (options.timer) timer = setTimeout(() => settle({ isConfirmed: false, isDismissed: true, dismiss: 'timer' }), options.timer)
  return promise
}

async function confirm() {
  const options = activeDialog.value?.options
  if (!options || dialogUi.loading) return
  dialogUi.validation = ''
  const value = options.input ? dialogUi.inputValue : undefined
  if (options.inputValidator) {
    const message = await options.inputValidator(value)
    if (message) { dialogUi.validation = String(message); return }
  }
  let confirmedValue = value
  if (options.preConfirm) {
    dialogUi.loading = true
    try {
      const result = await options.preConfirm(value)
      if (result === false || dialogUi.validation) return
      confirmedValue = result === undefined ? value : result
    } catch (error) {
      dialogUi.validation = error instanceof Error ? error.message : String(error)
      return
    } finally { dialogUi.loading = false }
  }
  if (activeDialog.value?.options !== options) return
  settle({ isConfirmed: true, isDismissed: false, value: confirmedValue })
}

function cancel(reason = 'cancel') { settle({ isConfirmed: false, isDismissed: true, dismiss: reason }) }

const dialogs = {
  fire,
  confirm,
  cancel,
  close: () => cancel('close'),
  showLoading: () => { dialogUi.loading = true },
  showValidationMessage: (message: string) => { dialogUi.validation = message },
  getHtmlContainer: () => htmlContainer,
  mixin: (defaults: DialogOptions) => ({ fire: (options: DialogOptions | string, text?: string, icon?: string) => fire({ ...defaults, ...normalize(options, text, icon) }) }),
  DismissReason: { cancel: 'cancel', close: 'close', backdrop: 'backdrop', timer: 'timer' },
}

export default dialogs
