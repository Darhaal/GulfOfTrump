// Speech to text on the player's own computer (src/lib/voice/whisper.ts): for
// the desktop app, whose browser engine has no speech service of its own, and
// for browsers without one. Whisper (base, multilingual) runs in WebAssembly
// through transformers.js; nothing leaves the computer once it is downloaded.
//
// The code is fetched from fixed versions on jsDelivr and checked against its
// SHA-384 before it runs, so a changed file is refused rather than run; the
// model comes from a fixed revision on Hugging Face. Both stay in the
// browser's cache storage, so the download happens once.
//
// In:  { type: "load" } | { type: "transcribe", id, audio: Float32Array (16 kHz mono), language: "ru" | "uk" | "en" }
// Out: { type: "progress", loaded, total } | { type: "ready" } | { type: "text", id, text } | { type: "error", id?, message }

const RUNTIME_CACHE = "gulf-voice-runtime";
const MODEL_CACHE = "gulf-voice-model";
const FILES = {
  transformers: {
    url: "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/dist/transformers.min.js",
    integrity: "sha384-3TA7bWonh/FGdhkvnr9EMFCoFqikJ5aJQEV8RlUgOmBFIF9z3W+h67aRdQPRxN9d",
    size: 558373,
  },
  ortMjs: {
    url: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0-dev.20260416-b7804b056c/dist/ort-wasm-simd-threaded.asyncify.mjs",
    integrity: "sha384-3PtbyJKPDRoZCNL6u5IQ3uw3aYqeALuxedvWoGF8Syni60K8769ZoBCVSyxZVllq",
    size: 47389,
  },
  ortWasm: {
    url: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0-dev.20260416-b7804b056c/dist/ort-wasm-simd-threaded.asyncify.wasm",
    integrity: "sha384-ppxy8GpR5oK0pciZqI/PSDs0fl2gPFvA509fIkdyEwIAvXabDahpzW9fPyZq/fLs",
    size: 23567050,
  },
};
const MODEL = "onnx-community/whisper-base";
const REVISION = "1846881b6b3a3024392c1eea3ad983695bc23925";
/** Bytes of everything above, for the progress bar: the runtime and the model's files. */
const TOTAL = 103_000_000;

const done = new Map();
let runtimeLoaded = 0;
const report = () => {
  let loaded = runtimeLoaded;
  for (const v of done.values()) loaded += v;
  self.postMessage({ type: "progress", loaded: Math.min(loaded, TOTAL - 1), total: TOTAL });
};

const base64 = (buffer) => {
  let s = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** A pinned file, from the cache or the network, refused unless its hash matches. */
async function pinned(file) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(file.url);
  const response = cached ?? (await fetch(file.url, { credentials: "omit", referrerPolicy: "no-referrer" }));
  if (!response.ok) throw new Error(`download failed: ${response.status}`);
  const buffer = await response.arrayBuffer();
  const digest = "sha384-" + base64(await crypto.subtle.digest("SHA-384", buffer));
  if (digest !== file.integrity) {
    await cache.delete(file.url);
    throw new Error("integrity check failed");
  }
  if (!cached) await cache.put(file.url, new Response(buffer, { headers: { "content-type": "application/octet-stream" } }));
  runtimeLoaded += file.size;
  report();
  return buffer;
}

const blobUrl = (buffer, type) => URL.createObjectURL(new Blob([buffer], { type }));

let loading = null;
function load() {
  loading ??= (async () => {
    const [js, mjs, wasm] = await Promise.all([pinned(FILES.transformers), pinned(FILES.ortMjs), pinned(FILES.ortWasm)]);
    const { pipeline, env } = await import(blobUrl(js, "text/javascript"));
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    env.cacheKey = MODEL_CACHE;
    const wasmEnv = env.backends.onnx.wasm;
    wasmEnv.wasmPaths = { mjs: blobUrl(mjs, "text/javascript"), wasm: blobUrl(wasm, "application/wasm") };
    wasmEnv.wasmBinary = wasm;
    wasmEnv.numThreads = 1;
    return pipeline("automatic-speech-recognition", MODEL, {
      revision: REVISION,
      dtype: "q8",
      device: "wasm",
      // This runtime's fuller graph optimisations refuse the quantised decoder
      // ("Missing required scale" in TransposeDQWeightsForMatMulNBits).
      session_options: { graphOptimizationLevel: "basic" },
      progress_callback: (p) => {
        if (p.status === "progress" && p.file) {
          done.set(p.file, p.loaded ?? 0);
          report();
        }
      },
    });
  })();
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

self.onmessage = async ({ data }) => {
  if (data?.type === "load") {
    try {
      await load();
      self.postMessage({ type: "ready" });
    } catch (error) {
      self.postMessage({ type: "error", message: String(error?.message ?? error) });
    }
    return;
  }
  if (data?.type === "transcribe") {
    try {
      const asr = await load();
      self.postMessage({ type: "ready" });
      const out = await asr(data.audio, { language: data.language, task: "transcribe", chunk_length_s: 30, stride_length_s: 5 });
      self.postMessage({ type: "text", id: data.id, text: String(out?.text ?? "") });
    } catch (error) {
      self.postMessage({ type: "error", id: data.id, message: String(error?.message ?? error) });
    }
  }
};
