module.exports = {
  content: [
    "./layouts/**/*.html",
    "./content/**/*.md",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          light: '#faf8f5',
          dark: '#1a1a2e'
        },
        surface: {
          light: '#ffffff',
          dark: '#252538'
        },
        accent: {
          light: '#a78bfa',
          dark: '#9f7aea',
          soft: {
            light: '#e9d5ff',
            dark: '#4c366d'
          }
        },
        border: {
          light: '#e2e8f0',
          dark: '#3d3d56'
        },
        link: {
          light: '#8b5cf6',
          dark: '#b794f6'
        },
        'code-bg': {
          light: '#f7fafc',
          dark: '#2d2d44'
        }
      }
    }
  },
  plugins: [],
}
