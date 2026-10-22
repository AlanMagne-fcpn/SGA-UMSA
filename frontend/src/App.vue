<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import { computed, onMounted, onUnmounted } from 'vue'
import { useTheme } from 'vuetify'
import AppNavbar from './layouts/AppNavbar.vue'
import AppFooter from './layouts/AppFooter.vue'
import ForcePasswordChange from './components/ForcePasswordChange.vue'
import DialogHost from './components/ui/DialogHost.vue'

const route = useRoute()
const theme = useTheme()
let themeObserver: MutationObserver | undefined
onMounted(() => {
  const syncTheme = () => { theme.global.name.value = document.documentElement.classList.contains('dark') ? 'sgeaDark' : 'sgeaLight' }
  syncTheme()
  themeObserver = new MutationObserver(syncTheme)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})
onUnmounted(() => themeObserver?.disconnect())
// Rutas que tienen su propio layout (no necesitan navbar/footer globales)
const isDashboard = computed(() =>
  route.path.startsWith('/coordinador') ||
  route.path.startsWith('/ponente') ||
  route.path.startsWith('/estudiante') ||
  route.path.startsWith('/admin') ||
  route.path.startsWith('/logistica')
)

const showFooter = computed(() => route.path === '/' || route.path === '/eventos' || route.path.startsWith('/eventos/') || route.path.startsWith('/cursos/'))
</script>

<template>
  <VApp class="min-h-[100vh] flex flex-col font-sans antialiased text-gray-900 bg-white dark:bg-gray-950 dark:text-gray-100 transition-colors duration-300">

    <AppNavbar v-if="!isDashboard" />
    <main class="flex-grow">
      <RouterView />
    </main>
    <AppFooter v-if="showFooter" />

    <!-- Overlay de seguridad global -->
    <ForcePasswordChange />
    <DialogHost />
  </VApp>
</template>


