/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Clair Obscur Theme Colors
        clair: {
          // Gold Tones (Light/Hope)
          gold: {
            50: '#FAF9F6',    // Cream white
            100: '#F7E7CE',   // Champagne
            200: '#F4E4BC',   // Light gold
            300: '#E6D48A',   // Soft gold
            400: '#D4AF37',   // Primary gold
            500: '#B8860B',   // Antique gold
            600: '#9A7209',   // Deep gold
            700: '#7D5E08',   // Darker gold
            800: '#5F4906',   // Bronze
            900: '#413204',   // Dark bronze
          },
          // Black Tones (Shadow/Mystery)
          shadow: {
            50: '#F5F5F7',    // Very light gray
            100: '#8B7355',   // Warm gray
            200: '#6B6B6D',   // Medium gray
            300: '#4A4A4C',   // Dark gray
            400: '#3A3A3C',   // Slate
            500: '#2C2C2E',   // Graphite
            600: '#1C1C1E',   // Charcoal
            700: '#161618',   // Deep charcoal
            800: '#0F0F10',   // Near black
            900: '#000000',   // Pure black
          },
          // Purple Accents (Magic/Mysticism)
          mystical: {
            50: '#F3E8FF',    // Very light purple
            100: '#E9D5FF',   // Light lavender
            200: '#C084FC',   // Lavender
            300: '#A855F7',   // Medium purple
            400: '#9333EA',   // Purple
            500: '#6B46C1',   // Royal purple
            600: '#581C87',   // Plum
            700: '#4C1D95',   // Deep amethyst
            800: '#3B1A78',   // Dark purple
            900: '#2E1065',   // Very dark purple
          },
          // Character Colors
          maelle: '#6B46C1',     // Royal Purple
          gustave: '#800020',    // Burgundy
          lune: '#581C87',       // Plum
          sciel: '#355E3B',      // Forest Green
          // Status Colors
          danger: '#800020',     // Burgundy
          warning: '#B8860B',    // Antique Gold
          success: '#355E3B',    // Forest Green
          info: '#6B46C1',       // Royal Purple
        }
      },
      fontFamily: {
        // Belle Époque inspired fonts
        'serif': ['Playfair Display', 'Georgia', 'serif'],
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'display': ['Cinzel', 'serif'],
      },
      backgroundImage: {
        'clair-gradient': 'linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 50%, #3A3A3C 100%)',
        'gold-gradient': 'linear-gradient(135deg, #D4AF37 0%, #B8860B 100%)',
        'mystical-gradient': 'linear-gradient(135deg, #6B46C1 0%, #581C87 100%)',
        'shadow-gradient': 'linear-gradient(180deg, #000000 0%, #1C1C1E 100%)',
      },
      boxShadow: {
        'clair': '0 4px 20px rgba(212, 175, 55, 0.2)',
        'mystical': '0 4px 20px rgba(107, 70, 193, 0.3)',
        'shadow': '0 8px 32px rgba(0, 0, 0, 0.6)',
      },
      borderColor: {
        'clair-gold': '#D4AF37',
        'clair-mystical': '#6B46C1',
      }
    },
  },
  plugins: [],
}