import { Miniflare } from "miniflare";

const mf = new Miniflare({
  modules: true,
  script: `
    export default {
      async fetch(request, env, ctx) {
        try {
          const decoder = new TextDecoder('macintosh');
          return new Response("OK");
        } catch(e) {
          return new Response(e.toString(), { status: 500 });
        }
      }
    }
  `
});

async function run() {
  const res = await mf.dispatchFetch("http://localhost");
  console.log(await res.text());
}
run();
