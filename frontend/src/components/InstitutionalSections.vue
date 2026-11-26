<script setup lang="ts">
import { getImageUrl } from '@/services/api';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const pilares = [
  { icon: 'visibility', titleKey: 'institutional.mission_title', bodyKey: 'institutional.mission_body' },
  { icon: 'rocket_launch', titleKey: 'institutional.vision_title', bodyKey: 'institutional.vision_body' },
  { icon: 'verified', titleKey: 'institutional.values_title', bodyKey: 'institutional.values_body' },
];

const servicios = [
  { icon: 'event', titleKey: 'institutional.service_events_title', bodyKey: 'institutional.service_events_body' },
  { icon: 'school', titleKey: 'institutional.service_courses_title', bodyKey: 'institutional.service_courses_body' },
  { icon: 'workspace_premium', titleKey: 'institutional.service_certs_title', bodyKey: 'institutional.service_certs_body' },
  { icon: 'groups', titleKey: 'institutional.service_community_title', bodyKey: 'institutional.service_community_body' },
];

const organigrama = [
  { icon: 'account_balance', titleKey: 'institutional.org_umsa_title', bodyKey: 'institutional.org_umsa_body' },
  { icon: 'science', titleKey: 'institutional.org_fcpn_title', bodyKey: 'institutional.org_fcpn_body' },
  { icon: 'developer_board', titleKey: 'institutional.org_sgea_title', bodyKey: 'institutional.org_sgea_body' },
];
</script>

<template>
  <div class="institutional-sections bg-[#f4f8fc] text-slate-900 dark:bg-[#071321] dark:text-white">
    <!-- QUIÉNES SOMOS / INFORMACIÓN -->
    <section id="informacion" class="scroll-mt-28 border-t border-slate-200/80 py-20 dark:border-white/10 md:py-28">
      <div class="mx-auto max-w-[1440px] px-6 sm:px-10 lg:px-16">
        <div class="mb-12 max-w-3xl">
          <p class="text-[11px] font-black uppercase tracking-[0.22em] text-[#0069b4] dark:text-sky-300">
            {{ t('institutional.about_eyebrow') }}
          </p>
          <h2 class="mt-3 text-3xl font-black tracking-tight text-[#012248] dark:text-white md:text-5xl">
            {{ t('institutional.about_title') }}
          </h2>
          <p class="mt-5 text-base leading-8 text-slate-600 dark:text-slate-300 md:text-lg">
            {{ t('institutional.about_lead') }}
          </p>
        </div>

        <div class="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
          <article class="rounded-[2rem] border border-slate-200/90 bg-white p-8 shadow-[0_24px_60px_-40px_rgba(1,34,72,0.35)] dark:border-white/10 dark:bg-[#0b1a2b] md:p-10">
            <div class="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#005b9f] dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300">
              <span class="material-symbols-outlined text-[16px]">apartment</span>
              {{ t('institutional.about_badge') }}
            </div>
            <p class="text-base leading-8 text-slate-600 dark:text-slate-300">
              {{ t('institutional.about_body_1') }}
            </p>
            <p class="mt-4 text-base leading-8 text-slate-600 dark:text-slate-300">
              {{ t('institutional.about_body_2') }}
            </p>
            <div class="mt-8 grid gap-3 sm:grid-cols-3">
              <div
                v-for="item in [
                  { value: t('institutional.stat_events'), label: t('institutional.stat_events_label') },
                  { value: t('institutional.stat_roles'), label: t('institutional.stat_roles_label') },
                  { value: t('institutional.stat_certs'), label: t('institutional.stat_certs_label') },
                ]"
                :key="item.label"
                class="rounded-2xl border border-slate-100 bg-[#f7fbff] px-4 py-4 dark:border-white/10 dark:bg-white/5"
              >
                <p class="text-2xl font-black text-[#0069b4] dark:text-sky-300">{{ item.value }}</p>
                <p class="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{{ item.label }}</p>
              </div>
            </div>
          </article>

          <aside class="relative overflow-hidden rounded-[2rem] border border-slate-200/90 bg-[#001a36] text-white shadow-[0_24px_60px_-40px_rgba(1,34,72,0.55)] dark:border-white/10">
            <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(0,112,187,0.35),transparent_55%)]"></div>
            <div class="relative flex h-full flex-col justify-between p-8 md:p-10">
              <div>
                <p class="text-[11px] font-black uppercase tracking-[0.2em] text-sky-300">{{ t('institutional.commitment_eyebrow') }}</p>
                <h3 class="mt-3 text-2xl font-black leading-tight md:text-3xl">{{ t('institutional.commitment_title') }}</h3>
                <p class="mt-4 text-sm leading-7 text-slate-200/90">{{ t('institutional.commitment_body') }}</p>
              </div>
              <div class="mt-8 flex flex-wrap items-center gap-4 border-t border-white/15 pt-6">
                <img src="/logo/logoOficial.png" alt="SGEA" class="h-10 w-auto object-contain brightness-110" />
                <div class="h-8 w-px bg-white/20"></div>
                <img :src="getImageUrl('logo', 'EscudoFCPN.png')" alt="FCPN" class="h-10 w-auto object-contain" />
                <img :src="getImageUrl('logo', 'LOGO UMSA OFICIAL.png')" alt="UMSA" class="h-10 w-auto object-contain" />
              </div>
            </div>
          </aside>
        </div>

        <div class="mt-10 grid gap-5 md:grid-cols-3">
          <article
            v-for="pilar in pilares"
            :key="pilar.titleKey"
            class="rounded-[1.75rem] border border-slate-200/90 bg-white p-7 transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-[#0b1a2b]"
          >
            <div class="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#0069b4] text-white shadow-md shadow-[#0069b4]/25">
              <span class="material-symbols-outlined text-[22px]">{{ pilar.icon }}</span>
            </div>
            <h3 class="text-lg font-black text-[#012248] dark:text-white">{{ t(pilar.titleKey) }}</h3>
            <p class="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{{ t(pilar.bodyKey) }}</p>
          </article>
        </div>
      </div>
    </section>

    <!-- ORGANIZACIÓN -->
    <section id="organizacion" class="scroll-mt-28 border-t border-slate-200/80 bg-white py-20 dark:border-white/10 dark:bg-[#0a1624] md:py-28">
      <div class="mx-auto max-w-[1440px] px-6 sm:px-10 lg:px-16">
        <div class="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div class="max-w-2xl">
            <p class="text-[11px] font-black uppercase tracking-[0.22em] text-[#0069b4] dark:text-sky-300">
              {{ t('institutional.org_eyebrow') }}
            </p>
            <h2 class="mt-3 text-3xl font-black tracking-tight text-[#012248] dark:text-white md:text-4xl">
              {{ t('institutional.org_title') }}
            </h2>
            <p class="mt-4 text-base leading-8 text-slate-600 dark:text-slate-300">
              {{ t('institutional.org_lead') }}
            </p>
          </div>
        </div>

        <div class="grid gap-5 lg:grid-cols-3">
          <article
            v-for="(item, index) in organigrama"
            :key="item.titleKey"
            class="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-[#f7fbff] p-7 dark:border-white/10 dark:bg-[#0f2236]"
          >
            <span class="absolute right-5 top-5 text-5xl font-black text-[#0069b4]/10 dark:text-sky-400/10">0{{ index + 1 }}</span>
            <div class="relative">
              <div class="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-[#0069b4]/20 bg-white text-[#0069b4] dark:bg-[#001a36] dark:text-sky-300">
                <span class="material-symbols-outlined text-[22px]">{{ item.icon }}</span>
              </div>
              <h3 class="text-lg font-black text-[#012248] dark:text-white">{{ t(item.titleKey) }}</h3>
              <p class="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{{ t(item.bodyKey) }}</p>
            </div>
          </article>
        </div>

        <div class="mt-10 rounded-[2rem] border border-slate-200 bg-[#f4f8fc] p-8 dark:border-white/10 dark:bg-[#071321] md:p-10">
          <h3 class="text-sm font-black uppercase tracking-[0.18em] text-[#0069b4] dark:text-sky-300">
            {{ t('institutional.services_title') }}
          </h3>
          <div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div
              v-for="servicio in servicios"
              :key="servicio.titleKey"
              class="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-white/10 dark:bg-[#0b1a2b]"
            >
              <span class="material-symbols-outlined mb-3 text-[26px] text-[#0069b4] dark:text-sky-300">{{ servicio.icon }}</span>
              <p class="text-sm font-black text-[#012248] dark:text-white">{{ t(servicio.titleKey) }}</p>
              <p class="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">{{ t(servicio.bodyKey) }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- UBICACIÓN -->
    <section id="ubicacion" class="scroll-mt-28 border-t border-slate-200/80 py-20 dark:border-white/10 md:py-28">
      <div class="mx-auto max-w-[1440px] px-6 sm:px-10 lg:px-16">
        <div class="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p class="text-[11px] font-black uppercase tracking-[0.22em] text-[#0069b4] dark:text-sky-300">
              {{ t('institutional.location_eyebrow') }}
            </p>
            <h2 class="mt-3 text-3xl font-black tracking-tight text-[#012248] dark:text-white md:text-4xl">
              {{ t('institutional.location_title') }}
            </h2>
            <p class="mt-4 text-base leading-8 text-slate-600 dark:text-slate-300">
              {{ t('institutional.location_lead') }}
            </p>

            <div class="mt-8 space-y-4">
              <div class="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#0b1a2b]">
                <span class="material-symbols-outlined text-[#0069b4] dark:text-sky-300">location_on</span>
                <div>
                  <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">{{ t('institutional.location_address_label') }}</p>
                  <p class="mt-1 text-sm font-bold leading-6 text-slate-700 dark:text-slate-200">{{ t('footer.address') }}</p>
                </div>
              </div>
              <div class="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#0b1a2b]">
                <span class="material-symbols-outlined text-[#0069b4] dark:text-sky-300">schedule</span>
                <div>
                  <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">{{ t('institutional.location_hours_label') }}</p>
                  <p class="mt-1 text-sm font-bold leading-6 text-slate-700 dark:text-slate-200">{{ t('institutional.location_hours') }}</p>
                </div>
              </div>
              <div class="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#0b1a2b]">
                <span class="material-symbols-outlined text-[#0069b4] dark:text-sky-300">public</span>
                <div>
                  <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">{{ t('institutional.location_web_label') }}</p>
                  <p class="mt-1 text-sm font-bold leading-6 text-slate-700 dark:text-slate-200">
                    <a href="https://www.umsa.bo/" target="_blank" rel="noopener" class="hover:text-[#0069b4]">www.umsa.bo</a>
                    ·
                    <a href="https://www.fcpn.edu.bo/" target="_blank" rel="noopener" class="hover:text-[#0069b4]">www.fcpn.edu.bo</a>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="overflow-hidden rounded-[2rem] border border-slate-200 shadow-[0_24px_60px_-40px_rgba(1,34,72,0.45)] dark:border-white/10">
            <iframe
              title="Mapa UMSA"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15301.761763784013!2d-68.1332029785816!3d-16.505086782352123!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x915edf0a00000001%3A0x6420546944e8574d!2sUniversidad%20Mayor%20de%20San%20Andr%C3%A9s!5e0!3m2!1ses!2sbo!4v1713670000000!5m2!1ses!2sbo"
              width="100%"
              height="460"
              style="border:0;"
              allowfullscreen
              loading="lazy"
              referrerpolicy="no-referrer-when-downgrade"
              class="w-full grayscale-[30%] contrast-110 transition duration-700 hover:grayscale-0 dark:invert"
            ></iframe>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
