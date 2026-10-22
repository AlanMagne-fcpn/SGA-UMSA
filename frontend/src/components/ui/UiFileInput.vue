<script setup lang="ts">
import { ref, useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })
const attrs = useAttrs()
const files = ref<File[]>([])
const emit = defineEmits<{ change: [event: Event] }>()

function update(value: File | File[] | null) {
  files.value = value == null ? [] : Array.isArray(value) ? value : [value]
  emit('change', { target: { files: files.value } } as unknown as Event)
}
</script>

<template>
  <VFileInput v-bind="attrs" :model-value="files" @update:model-value="update" />
</template>
