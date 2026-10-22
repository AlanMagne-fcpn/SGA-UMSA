<script setup lang="ts">
import { getImageUrl } from '@/services/api'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="welcome-page min-h-screen overflow-hidden bg-[#f4f8fc] text-slate-900 dark:bg-[#071321] dark:text-white">
    <div class="pointer-events-none absolute inset-x-0 top-16 h-[700px] overflow-hidden" aria-hidden="true">
      <div class="absolute -left-48 top-12 h-[520px] w-[520px] rounded-full bg-sky-200/45 blur-3xl dark:bg-sky-500/10"></div>
      <div class="absolute -right-44 top-40 h-[520px] w-[520px] rounded-full bg-blue-200/50 blur-3xl dark:bg-blue-500/10"></div>
    </div>

    <div class="relative mx-auto max-w-[1440px] px-6 pb-20 pt-36 sm:px-10 lg:px-16 lg:pt-40">
      <div class="grid items-center gap-14 lg:grid-cols-[1fr_0.94fr] lg:gap-16">
        <div class="max-w-2xl">
          <div class="mb-8 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/85 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#005b9f] shadow-sm dark:border-sky-500/25 dark:bg-white/5 dark:text-sky-300">
            <span class="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.14)]"></span>
            {{ t('welcome.eyebrow') }}
          </div>

          <img src="/logo/logoOficial.png" alt="Logo oficial del sistema" class="mb-7 h-20 w-auto object-contain drop-shadow-md sm:h-24" />

          <h1 class="max-w-[760px] text-[clamp(3.2rem,5.8vw,6rem)] font-black leading-[0.98] tracking-[-0.055em]">
            {{ t('welcome.heading_start') }} <span class="block bg-gradient-to-r from-[#0069b4] via-[#008fd0] to-[#373acb] bg-clip-text text-transparent">{{ t('welcome.heading_accent') }}</span>
          </h1>

          <p class="mt-7 max-w-xl text-base leading-8 text-slate-600 dark:text-slate-300 sm:text-lg">
            {{ t('welcome.description') }}
          </p>

          <div class="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <VBtn to="/eventos" color="primary" size="x-large" class="welcome-primary-btn w-full px-8 font-black sm:w-auto">
              <VIcon start>event_available</VIcon>
              {{ t('welcome.explore') }}
              <VIcon end>arrow_forward</VIcon>
            </VBtn>
            <VBtn to="/register" variant="outlined" color="primary" size="x-large" class="w-full px-7 font-bold sm:w-auto">
              <VIcon start>person_add</VIcon>
              {{ t('welcome.register') }}
            </VBtn>
          </div>

          <p class="mt-5 flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <VIcon size="18" color="primary">touch_app</VIcon>
            {{ t('welcome.hint') }}
          </p>
        </div>

        <div class="relative">
          <div class="absolute -inset-5 rounded-[3rem] bg-gradient-to-br from-sky-300/35 via-blue-200/15 to-indigo-300/35 blur-2xl dark:from-sky-500/15 dark:to-indigo-500/15" aria-hidden="true"></div>
          <VCard class="relative overflow-hidden rounded-[2.25rem] border border-white/70 bg-[#001a36] shadow-[0_36px_85px_-35px_rgba(0,47,96,0.55)] dark:border-white/10">
            <div class="relative aspect-[1.1] min-h-[430px] sm:aspect-[1.17] lg:aspect-[0.95]">
              <img src="/fondo%20de%20bienvenida.png" alt="" class="absolute inset-0 h-full w-full object-cover object-center opacity-85" />
              <div class="absolute inset-0 bg-gradient-to-t from-[#001124] via-[#001a36]/10 to-[#00162d]/40"></div>
              <div class="absolute left-6 top-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white backdrop-blur-xl sm:left-8 sm:top-8">
                <VIcon size="16">verified</VIcon> {{ t('welcome.official') }}
              </div>
              <div class="absolute bottom-0 left-0 right-0 p-7 text-white sm:p-9">
                <p class="mb-2 text-[11px] font-black uppercase tracking-[0.25em] text-sky-300">{{ t('welcome.visual_eyebrow') }}</p>
                <h2 class="max-w-sm text-2xl font-black leading-tight sm:text-3xl">{{ t('welcome.visual_title') }}</h2>
                <div class="mt-5 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-wider text-white/85">
                  <span class="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">{{ t('welcome.step_explore') }}</span>
                  <span class="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">{{ t('welcome.step_register') }}</span>
                  <span class="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">{{ t('welcome.step_participate') }}</span>
                </div>
              </div>
            </div>
          </VCard>
        </div>
      </div>

      <div class="mt-20 flex flex-col gap-7 border-t border-slate-200/90 pt-8 dark:border-white/10 lg:mt-24 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-[11px] font-black uppercase tracking-[0.2em] text-[#0069b4] dark:text-sky-300">{{ t('welcome.institutions') }}</p>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ t('welcome.institutions_description') }}</p>
        </div>
        <div class="flex items-center gap-5 sm:gap-8">
          <img src="/logo/logoOficial.png" alt="Logo del sistema" class="h-12 w-auto object-contain sm:h-14" />
          <div class="h-9 w-px bg-slate-200 dark:bg-white/15"></div>
          <img :src="getImageUrl('logo', 'EscudoFCPN.png')" alt="FCPN" class="h-12 w-auto object-contain sm:h-14" />
          <img :src="getImageUrl('logo', 'LOGO UMSA OFICIAL.png')" alt="UMSA" class="h-12 w-auto object-contain sm:h-14" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.welcome-primary-btn { min-height: 56px; box-shadow: 0 14px 28px -13px rgba(0, 105, 180, 0.65); }
.welcome-primary-btn:hover { transform: translateY(-2px); box-shadow: 0 18px 32px -13px rgba(0, 105, 180, 0.75); }
</style>
