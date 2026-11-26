<script setup lang="ts">
import { RouterView } from 'vue-router';
import EstudianteHeader from './EstudianteHeader.vue';
import EstudianteSidebar from './EstudianteSidebar.vue';
import { useUIStore } from '@/stores/ui';

const uiStore = useUIStore();
</script>

<template>
  <div class="relative min-h-screen overflow-x-hidden bg-[#f8f9fc] transition-colors duration-300 dark:bg-black">
    <EstudianteHeader />
    <EstudianteSidebar />

    <div
      v-if="uiStore.isSidebarOpen"
      class="fixed inset-0 z-[105] bg-black/50 backdrop-blur-sm animate-in fade-in duration-300 lg:hidden"
      @click="uiStore.closeSidebar"
    />

    <main
      :class="[
        uiStore.isSidebarOpen ? 'lg:ml-72' : 'ml-0',
        'relative min-h-screen min-w-0 transition-all duration-300 pt-[75px]',
      ]"
    >
      <div class="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 sm:py-6 md:px-8 md:py-8">
        <RouterView />
      </div>
    </main>
  </div>
</template>
