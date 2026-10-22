<script setup lang="ts">
import { useAttrs, useSlots, Fragment, type PropType, type VNode } from 'vue'

defineOptions({ inheritAttrs: false })
const props = defineProps({
  modelValue: { type: null as unknown as PropType<any>, default: undefined },
  modelModifiers: { type: Object as PropType<Record<string, boolean>>, default: () => ({}) },
  multiple: { type: Boolean, default: false },
  value: { type: null as unknown as PropType<any>, default: undefined },
})
const emit = defineEmits<{ 'update:modelValue': [value: any]; change: [event: Event]; input: [event: Event] }>()
const attrs = useAttrs()
const selectAttrs = () => Object.fromEntries(Object.entries(attrs).filter(([key]) => key !== 'class'))
const slots = useSlots()
function label(nodes: VNode[]): string {
  return nodes.map(node => typeof node.children === 'string' ? node.children : Array.isArray(node.children) ? label(node.children as VNode[]) : '').join('').trim()
}
function collect(nodes: VNode[]): Array<{ title: string; value: any; disabled?: boolean }> {
  return nodes.flatMap(node => {
    if (node.type === Fragment || node.type === 'optgroup') return collect(Array.isArray(node.children) ? node.children as VNode[] : [])
    if (node.type !== 'option') return []
    const title = typeof node.children === 'string' ? node.children.trim() : label(Array.isArray(node.children) ? node.children as VNode[] : [])
    return [{ title, value: node.props?.value ?? title, disabled: node.props?.disabled === true || node.props?.disabled === '' }]
  })
}
const items = () => collect(slots.default?.() || [])
const controlClass = () => String(attrs.class || '').split(/\s+/).filter(token => !/^(bg-|border|rounded|shadow|ring|focus:|dark:bg-|dark:border-|dark:text-|dark:focus:|px-|py-|pl-|pr-|pt-|pb-|text-(xs|sm|base|lg|xl|[\[]))/.test(token)).join(' ')
function update(value: any) {
  const next = props.modelModifiers?.number && !props.multiple && value !== '' && value != null ? Number(value) : value
  emit('update:modelValue', next)
  const event = { target: { value: next } } as unknown as Event
  emit('change', event)
  emit('input', event)
}
</script>

<template>
  <VSelect v-bind="selectAttrs()" :class="['ui-select', controlClass()]" :items="items()" :multiple="multiple"
    :model-value="modelValue === undefined ? value : modelValue" @update:model-value="update" />
</template>
