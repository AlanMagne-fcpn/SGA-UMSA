import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
import autoprefixer from 'autoprefixer'

// Las utilidades del proyecto conservan sus ajustes visuales sobre los componentes Vuetify.
const vuetifyLayer = {
  postcssPlugin: 'sgea-vuetify-layer',
  OnceExit(root) {
    const file = root.source?.input.file?.replaceAll('\\', '/') || ''
    if (!file.includes('/node_modules/vuetify/')) return
    // Tailwind owns these shared utilities, including their dark: variants.
    // Vuetify adds !important backgrounds and implicit text colors to them.
    const sharedColors = new Set([
      '.bg-white', '.bg-black', '.bg-transparent',
      '.text-white', '.text-black', '.text-transparent',
    ])
    root.walkRules(rule => {
      if (sharedColors.has(rule.selector)) rule.remove()
    })
    const layer = postcss.atRule({ name: 'layer', params: 'vuetify' })
    layer.append(...root.nodes.slice())
    root.append(layer)
  },
}

export default { plugins: [tailwind(), autoprefixer(), vuetifyLayer] }
