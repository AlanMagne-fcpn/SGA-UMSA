import './silenceConsole'
import './style.css'
import './utils/imageFallback'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { i18n } from './i18n'
import { vuetify } from './plugins/vuetify'
import UiInput from './components/ui/UiInput.vue'
import UiSelect from './components/ui/UiSelect.vue'
import UiFileInput from './components/ui/UiFileInput.vue'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(vuetify)
app.component('UiInput', UiInput)
app.component('UiSelect', UiSelect)
app.component('UiFileInput', UiFileInput)
app.use(router)
app.use(i18n as any) // "as any" evita el error de tipos de TypeScript con el Plugin de Vue

app.mount('#app')
