import { createVuetify } from 'vuetify'
import { VApp, VBtn, VCard, VCheckbox, VDialog, VFileInput, VIcon, VMenu, VProgressCircular, VSelect, VSheet, VSnackbar, VTable, VTextarea, VTextField } from 'vuetify/components'
import { aliases } from 'vuetify/iconsets/md'
import { h } from 'vue'
import 'vuetify/styles'

export const vuetify = createVuetify({
  components: { VApp, VBtn, VCard, VCheckbox, VDialog, VFileInput, VIcon, VMenu, VProgressCircular, VSelect, VSheet, VSnackbar, VTable, VTextarea, VTextField },
  icons: { defaultSet: 'md', aliases, sets: { md: { component: (props: any) => h(props.tag, { class: ['material-symbols-outlined', props.class], style: props.style }, props.icon) } } },
  defaults: {
    VBtn: { variant: 'flat', rounded: 'lg', height: 'auto' },
    VTextField: { variant: 'outlined', density: 'comfortable', hideDetails: 'auto' },
    VTextarea: { variant: 'outlined', density: 'comfortable', hideDetails: 'auto' },
    VSelect: { variant: 'outlined', density: 'comfortable', hideDetails: 'auto' },
    VCheckbox: { density: 'compact', hideDetails: 'auto' },
    VFileInput: { variant: 'outlined', density: 'comfortable', hideDetails: 'auto' },
    VTable: { density: 'comfortable' },
  },
  theme: {
    defaultTheme: document.documentElement.classList.contains('dark') ? 'sgeaDark' : 'sgeaLight',
    themes: {
      sgeaLight: {
        dark: false,
        colors: { primary: '#0070BB', secondary: '#012248', accent: '#BC9C31', success: '#059669', error: '#dc2626', surface: '#ffffff', background: '#f8f9fc' },
      },
      sgeaDark: {
        dark: true,
        colors: { primary: '#38bdf8', secondary: '#93c5fd', accent: '#BC9C31', success: '#34d399', error: '#f87171', surface: '#111827', background: '#030712' },
      },
    },
  },
})
