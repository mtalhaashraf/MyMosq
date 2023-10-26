import adapter from "@sveltejs/adapter-auto";
// import adapter from "@sveltejs/adapter-node";
// import adapter from "svelte-adapter-appengine";
import preprocess from "svelte-preprocess";
import path from "path";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    env: {
      publicPrefix: "MYMOSQ",
    },
    alias: {
      "@components": path.resolve("./src/lib/components"),
      "@data": path.resolve("./src/demo-data"),
      "@store": path.resolve("./src/lib/store"),
      "@apps": path.resolve("./src/lib/view/apps"),
      "@view": path.resolve("./src/lib/view"),
      "@utility": path.resolve("./src/lib/utility"),
      "@locales": path.resolve("./src/lib/locales"),
    },
  },
  preprocess: preprocess(),
};

export default config;
