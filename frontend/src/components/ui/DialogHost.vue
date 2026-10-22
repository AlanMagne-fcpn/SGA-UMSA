<script setup lang="ts">
import { computed } from 'vue'
import dialogs, { activeDialog, dialogUi, setHtmlContainer } from '@/services/dialogs'

const options = computed(() => activeDialog.value?.options || {})
const isToast = computed(() => Boolean(options.value.toast))
const iconName = computed(() => ({ success: 'check_circle', error: 'error', warning: 'warning', info: 'info', question: 'help' })[options.value.icon as 'success' | 'error' | 'warning' | 'info' | 'question'] || '')
const iconColor = computed(() => ({ success: 'success', error: 'error', warning: 'warning', info: 'primary', question: 'primary' })[options.value.icon as 'success' | 'error' | 'warning' | 'info' | 'question'] || 'primary')
const selectItems = computed(() => Object.entries(options.value.inputOptions || {}).map(([value, title]) => ({ value, title: String(title) })))
const htmlRef = (element: any) => setHtmlContainer(element?.$el || element || null)

function outside() {
  if (options.value.allowOutsideClick === false) return
  dialogs.cancel('backdrop')
}
</script>

<template>
  <VSnackbar v-if="activeDialog && isToast" :model-value="true" location="top end" color="surface" class="sgea-toast">
    <div class="flex items-center gap-3 font-semibold">
      <VIcon v-if="iconName" :color="iconColor">{{ iconName }}</VIcon>
      <span>{{ options.title || options.text }}</span>
    </div>
    <template #actions><VBtn icon="close" variant="text" @click="dialogs.close()" /></template>
  </VSnackbar>

  <VDialog v-else-if="activeDialog" :model-value="true" persistent class="sgea-dialog" width="100%" max-width="calc(100vw - 32px)" @click:outside="outside">
    <VCard class="w-full max-w-lg rounded-2xl shadow-2xl mx-auto p-6 md:p-8">
      <div class="flex flex-col items-center text-center gap-3">
        <VIcon v-if="iconName" :color="iconColor" size="42">{{ iconName }}</VIcon>
        <h2 v-if="options.title" class="text-xl font-bold text-slate-800 dark:text-white" v-html="options.title"></h2>
        <p v-if="options.text" class="text-sm text-slate-600 dark:text-slate-300">{{ options.text }}</p>
      </div>
      <div v-if="options.html" :ref="htmlRef" class="sgea-dialog-html mt-5 text-sm" v-html="options.html"></div>
      <div v-if="options.input" class="mt-5">
        <VTextarea v-if="options.input === 'textarea'" v-model="dialogUi.inputValue" :placeholder="options.inputPlaceholder" autofocus />
        <VSelect v-else-if="options.input === 'select'" v-model="dialogUi.inputValue" :items="selectItems" :placeholder="options.inputPlaceholder" autofocus />
        <VTextField v-else v-model="dialogUi.inputValue" :type="options.input" :placeholder="options.inputPlaceholder" autofocus />
      </div>
      <p v-if="dialogUi.validation" role="alert" class="mt-3 text-sm text-red-600">{{ dialogUi.validation }}</p>
      <p v-if="options.footer" class="mt-4 text-xs text-slate-500 text-center">{{ options.footer }}</p>
      <div v-if="dialogUi.loading" class="flex justify-center py-5"><VProgressCircular indeterminate color="primary" /></div>
      <div v-else-if="options.showConfirmButton !== false || options.showCancelButton" class="flex flex-wrap justify-center gap-3 mt-7">
        <VBtn v-if="options.showCancelButton" variant="tonal" @click="dialogs.cancel()">{{ options.cancelButtonText || 'Cancelar' }}</VBtn>
        <VBtn v-if="options.showConfirmButton !== false" color="primary" :style="options.confirmButtonColor ? { backgroundColor: options.confirmButtonColor } : undefined" @click="dialogs.confirm()">{{ options.confirmButtonText || 'Aceptar' }}</VBtn>
      </div>
    </VCard>
  </VDialog>
</template>
