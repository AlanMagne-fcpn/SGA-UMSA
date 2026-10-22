<script setup lang="ts">
import { computed } from 'vue';

const requisitos = defineModel<any>({ required: true });
const camposBase: Record<string, string> = {
  nombres: 'Nombres', primer_apellido: 'Primer apellido', segundo_apellido: 'Segundo apellido',
  documento_identidad: 'Documento de identidad', genero: 'Género', email: 'Correo electrónico',
  celular: 'Celular', pais_origen: 'País de origen', afiliacion: 'Afiliación', grado_academico: 'Grado académico',
};
const tipos: Record<string, string> = { text: 'Texto', number: 'Número', select: 'Lista de opciones', file: 'Archivo' };
const camposDisponibles = computed(() => [...new Set([...Object.keys(camposBase), ...Object.keys(requisitos.value.base)])]);
const agregar = () => requisitos.value.custom.push({ label: '', type: 'text', options: [] });
</script>

<template>
  <section class="space-y-5" aria-label="Requisitos de inscripción">
    <h3 class="text-base font-bold text-slate-900 dark:text-white">Requisitos de inscripción</h3>
    <p class="text-sm text-slate-600 dark:text-slate-300">Selecciona la información que se solicitará al inscribirse.</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label v-for="campo in camposDisponibles" :key="campo" class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
        <input v-model="requisitos.base[campo]" type="checkbox">
        {{ camposBase[String(campo)] || String(campo).replace(/_/g, ' ') }}
      </label>
    </div>
    <fieldset v-for="(requisito, index) in requisitos.custom" :key="index" class="space-y-3 rounded-xl border border-slate-300 dark:border-slate-600 p-4">
      <legend class="px-1 text-sm font-bold">Requisito {{ Number(index) + 1 }}</legend>
      <label class="block text-sm">Nombre del requisito
        <input v-model="requisito.label" :aria-label="`Nombre del requisito ${Number(index) + 1}`" type="text" maxlength="200" required>
      </label>
      <label class="block text-sm">Tipo de respuesta
        <select v-model="requisito.type" :aria-label="`Tipo de respuesta ${Number(index) + 1}`" :disabled="requisito.mandatory">
          <option v-if="!tipos[requisito.type]" :value="requisito.type">{{ requisito.type }}</option>
          <option v-for="(nombre, tipo) in tipos" :key="tipo" :value="tipo">{{ nombre }}</option>
        </select>
      </label>
      <label v-if="requisito.type === 'select'" class="block text-sm">Opciones (una por línea)
        <textarea :value="(requisito.options || []).join('\n')" :aria-label="`Opciones del requisito ${Number(index) + 1}`" rows="3"
          @input="requisito.options = ($event.target as HTMLTextAreaElement).value.split('\n')"></textarea>
      </label>
      <p v-if="requisito.mandatory" class="text-sm text-slate-600 dark:text-slate-300">Requisito obligatorio del sistema.</p>
      <button v-else type="button" class="text-sm font-bold text-red-600 dark:text-red-400" :aria-label="`Eliminar requisito ${Number(index) + 1}`" @click="requisitos.custom.splice(Number(index), 1)">Eliminar requisito</button>
    </fieldset>
    <button type="button" :disabled="requisitos.custom.length >= 10" class="text-sm font-bold text-blue-700 dark:text-blue-300 disabled:opacity-50" @click="agregar">Añadir requisito ({{ requisitos.custom.length }}/10)</button>
    <label class="block text-sm font-bold">Objetivos de aprendizaje
      <textarea v-model="requisitos.presentacion.objetivos" aria-label="Objetivos de aprendizaje" rows="3" placeholder="Un objetivo por línea"></textarea>
    </label>
    <label class="block text-sm font-bold">¿A quién está dirigida la actividad?
      <textarea v-model="requisitos.presentacion.publico_objetivo" aria-label="Público de la actividad" rows="2"></textarea>
    </label>
  </section>
</template>
