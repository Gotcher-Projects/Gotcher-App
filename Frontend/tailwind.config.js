/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        'brand-purple':   'hsl(var(--brand-purple) / <alpha-value>)',
        'brand-navy':     'hsl(var(--brand-navy)   / <alpha-value>)',
        'brand-pink':     'hsl(var(--brand-pink)   / <alpha-value>)',
        'brand-peach':    'hsl(var(--brand-peach)  / <alpha-value>)',
        'brand-lavender': 'hsl(var(--brand-lavender) / <alpha-value>)',
        'brand-mint':     'hsl(var(--brand-mint)   / <alpha-value>)',
        'color-success':  'hsl(var(--color-success)   / <alpha-value>)',
        'color-highlight':'hsl(var(--color-highlight) / <alpha-value>)',
        'color-warm':     'hsl(var(--color-warm)      / <alpha-value>)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        display: ['Poppins', 'ui-sans-serif'],
      },
    },
  },
  plugins: [],
};
