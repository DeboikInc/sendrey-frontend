const withMT = require("@material-tailwind/react/utils/withMT");

module.exports = withMT({
  darkMode: 'class',
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'black-100': '#131313',
        'black-200': '#000000',
        'gray-100': '#F1F4F7',
        'gray-200': '#F1F4F6',
        'gray-300': '#BEBEBE',
        'gray-400': '#B8B8B8',
        'gray-500': '#8A8A8A',
        'gray-600': '#969696',
        'gray-700': '#A1A1A1',
        'gray-800': '#727272',
        'gray-900': '#B9BEC3',
        'gray-1000': '#F8F8F8',
        'gray-1001': '#E8ECEF',
        'gray-1002': '#E1E1E1',
        'primary': '#F47C20',
        'secondary': '#152C3D',
        'tetiary':'#695BA7',
        'flash-white':'#EDEDEE',
        'marian':'#204199',
        'wine':' #6B2737'
      },
    },
  },
  plugins: [],
});
