import { sveltekit } from "@sveltejs/kit/vite";
import removeConsole from "vite-plugin-svelte-console-remover";

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [sveltekit(), removeConsole()],
  define: {
    "import.meta.env.VERCEL_ANALYTICS_ID": JSON.stringify(process.env.VERCEL_ANALYTICS_ID),
  },
  resolve: {
    dedupe: ["@fullcalendar/common"],
  },
  optimizeDeps: {
    include: ["@fullcalendar/common"],
  },
  /* target: "#svelte",
    vite: {
      ssr: {
        noExternal: ["dayjs", "svelet-fullcalendar"],
      },
    }, */
};

export default config;
