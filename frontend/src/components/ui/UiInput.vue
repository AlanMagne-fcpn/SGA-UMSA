<script setup lang="ts">
import { computed, useAttrs, type PropType } from 'vue'

// Compatibility layer for existing Vue form models during the Vuetify migration.
defineOptions({ inheritAttrs: false })
const props = defineProps({
  modelValue: { type: null as unknown as PropType<any>, default: undefined },
  modelModifiers: { type: Object as PropType<Record<string, boolean>>, default: () => ({}) },
  type: { type: String, default: 'text' },
  value: { type: null as unknown as PropType<any>, default: undefined },
  checked: { type: Boolean, default: undefined },
  trueValue: { type: null as unknown as PropType<any>, default: true },
  falseValue: { type: null as unknown as PropType<any>, default: false },
})
const emit = defineEmits<{
  'update:modelValue': [value: any]
  input: [event: Event]
  change: [event: Event]
}>()
const attrs = useAttrs()
const inputAttrs = () => Object.fromEntries(Object.entries(attrs).filter(([key]) => key !== 'class'))
const controlClass = () => {
  const oldClass = String(attrs.class || '')
  return oldClass.split(/\s+/).filter(token => !/^(bg-|border|rounded|shadow|ring|focus:|dark:bg-|dark:border-|dark:text-|dark:focus:|px-|py-|pl-|pr-|pt-|pb-|text-(xs|sm|base|lg|xl|[\[]))/.test(token)).join(' ')
}
const checkboxValue = computed(() => props.modelValue === undefined ? props.checked : props.modelValue)
function toModel(value: any) {
  if (props.type === 'number' || props.modelModifiers?.number) return value === '' || value == null ? '' : Number(value)
  return value
}
function emitChange(value: any) {
  const input = { target: { value, checked: Array.isArray(value) ? value.includes(props.value) : value === props.trueValue } } as unknown as Event
  emit('change', input)
}
function update(value: any) {
  const next = toModel(value)
  emit('update:modelValue', next)
  if (props.type === 'checkbox') emitChange(next)
}
</script>

<template>
  <VCheckbox v-if="type === 'checkbox'" v-bind="inputAttrs()" :class="['ui-input', controlClass()]"
    :model-value="checkboxValue" :value="value" :true-value="trueValue" :false-value="falseValue"
    @update:model-value="update" />
  <VTextField v-else v-bind="inputAttrs()" :class="['ui-input', controlClass()]" :type="type"
    :model-value="modelValue === undefined ? value : modelValue"
    @update:model-value="update" @input="emit('input', $event)" @change="emit('change', $event)" />
</template>
