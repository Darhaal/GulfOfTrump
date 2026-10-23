// Text to speech on the player's own computer (src/lib/voice/builtinVoice.ts):
// the game's own voices for a system with none for the language
// (docs/built-in-voice.md). The models run in WebAssembly through
// onnxruntime-web; nothing leaves the computer once they are downloaded.
//
// The runtime is fetched from a fixed version on jsDelivr and checked against
// its SHA-384 before it runs; each model comes from a fixed revision on
// Hugging Face and is checked against its SHA-256. Both stay in the browser's
// cache storage, so each download happens once. Where the page is
// cross-origin isolated (the desktop app) the runtime uses up to four threads.
//
// In:  { type: "load", voice } | { type: "speak", id, voice, ids: number[], speaker, lengthScale? (Piper's pace, below 1 faster) }
//      voice: { lang, kind: "piper" | "vits", url, sha256, bytes, sampleRate } (src/lib/voice/builtin.ts)
// Out: { type: "progress", lang, loaded, total } | { type: "ready", lang }
//      | { type: "audio", id, samples: Float32Array, sampleRate } | { type: "error", id?, lang?, message }

const RUNTIME_CACHE = "gulf-speech-runtime";
const MODEL_CACHE = "gulf-speech-model";
const FILES = {
  ort: {
    url: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.wasm.min.mjs",
    integrity: "sha384-gnybD0DbcdbgochNJEKfs1JeM+0iPWzSESNavtMDLT/E34RAPtXngFE4AVdlcScw",
    size: 48259,
  },
  // The runtime's loader, which it would otherwise look for beside itself – a blob has no beside.
  loader: {
    url: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort-wasm-simd-threaded.mjs",
    integrity: "sha384-LXMGGJ76ujT3yGw+OWQZVB6vBmJ7lqTO957Fh6ov3385aw3EncleBNFfYFAl3vXW",
    size: 20856,
  },
  wasm: {
    url: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort-wasm-simd-threaded.wasm",
    integrity: "sha384-Eu/XUdOA62yl+TueG792KtrQlAGAMW3g10sY4G3LBYyYZUtM126Z4Gr3ljTlXUGG",
    size: 11210254,
  },
};
/** Piper's noise and noise width; its length scale (pace) comes with each request. */
const PIPER_NOISE = 0.667;
const PIPER_NOISE_W = 0.8;

const base64 = (buffer) => {
  let s = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const hex = (buffer) => Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
const blobUrl = (buffer, type) => URL.createObjectURL(new Blob([buffer], { type }));

/** A file from the cache, or from the network with its progress told, as an ArrayBuffer. */
async function download(cacheName, url, onBytes) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(url);
  if (cached) {
    const buffer = await cached.arrayBuffer();
    onBytes(buffer.byteLength);
    return { buffer, cache, fresh: false };
  }
  const response = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer" });
  if (!response.ok || !response.body) throw new Error(`download failed: ${response.status}`);
  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onBytes(loaded);
  }
  const bytes = new Uint8Array(loaded);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return { buffer: bytes.buffer, cache, fresh: true };
}

let runtime = null;
/** The runtime, shared by the voices; `onBytes` tells how much of it has come. */
function loadRuntime(onBytes) {
  runtime ??= (async () => {
    const got = { ort: 0, loader: 0, wasm: 0 };
    const tell = () => onBytes(got.ort + got.loader + got.wasm);
    const pinned = async (key) => {
      const file = FILES[key];
      const { buffer, cache, fresh } = await download(RUNTIME_CACHE, file.url, (n) => {
        got[key] = n;
        tell();
      });
      const digest = "sha384-" + base64(await crypto.subtle.digest("SHA-384", buffer));
      if (digest !== file.integrity) {
        await cache.delete(file.url);
        throw new Error("integrity check failed");
      }
      if (fresh) await cache.put(file.url, new Response(buffer, { headers: { "content-type": "application/octet-stream" } }));
      return buffer;
    };
    const [js, loader, wasm] = await Promise.all([pinned("ort"), pinned("loader"), pinned("wasm")]);
    const ort = await import(blobUrl(js, "text/javascript"));
    // The checked files are handed over as blobs. Not as `wasmBinary`: with it the runtime gives
    // its loader no way to find the wasm, and the loader then builds a path from a blob URL and fails.
    ort.env.wasm.wasmPaths = { mjs: blobUrl(loader, "text/javascript"), wasm: blobUrl(wasm, "application/wasm") };
    ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.max(1, Math.min(4, navigator.hardwareConcurrency || 1)) : 1;
    return ort;
  })();
  runtime.catch(() => {
    runtime = null;
  });
  return runtime;
}

const sessions = new Map();
/** A voice's session: the runtime and its model, downloaded the first time with progress. */
function loadVoice(voice) {
  if (!sessions.has(voice.lang)) {
    const promise = (async () => {
      const RUNTIME_TOTAL = FILES.ort.size + FILES.loader.size + FILES.wasm.size;
      const total = RUNTIME_TOTAL + voice.bytes;
      let runtimeBytes = 0;
      let modelBytes = 0;
      let last = 0;
      const tell = () => {
        const now = Date.now();
        if (now - last < 150) return;
        last = now;
        self.postMessage({ type: "progress", lang: voice.lang, loaded: Math.min(runtimeBytes + modelBytes, total - 1), total });
      };
      const [ort, model] = await Promise.all([
        loadRuntime((n) => {
          runtimeBytes = n;
          tell();
        }),
        (async () => {
          const { buffer, cache, fresh } = await download(MODEL_CACHE, voice.url, (n) => {
            modelBytes = n;
            tell();
          });
          if (hex(await crypto.subtle.digest("SHA-256", buffer)) !== voice.sha256) {
            await cache.delete(voice.url);
            throw new Error("integrity check failed");
          }
          if (fresh) await cache.put(voice.url, new Response(buffer, { headers: { "content-type": "application/octet-stream" } }));
          return buffer;
        })(),
      ]);
      const session = await ort.InferenceSession.create(new Uint8Array(model), { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
      return { ort, session };
    })();
    promise.catch(() => sessions.delete(voice.lang));
    sessions.set(voice.lang, promise);
  }
  return sessions.get(voice.lang);
}

/** One piece of speech: the model's samples, peak-normalised the way Piper does. */
async function synthesize(voice, ids, speaker, lengthScale) {
  const { ort, session } = await loadVoice(voice);
  const int64 = (values, dims) => new ort.Tensor("int64", BigInt64Array.from(values, (v) => BigInt(v)), dims);
  const sid = int64([speaker], [1]);
  let output;
  if (voice.kind === "piper") {
    const result = await session.run({
      input: int64(ids, [1, ids.length]),
      input_lengths: int64([ids.length], [1]),
      scales: new ort.Tensor("float32", Float32Array.from([PIPER_NOISE, Math.min(1.5, Math.max(0.6, lengthScale || 1)), PIPER_NOISE_W]), [3]),
      sid,
    });
    output = result[session.outputNames[0]];
  } else {
    // The VITS export has more outputs than the sound; only the sound is asked for.
    const result = await session.run({ input_ids: int64(ids, [1, ids.length]), attention_mask: int64(ids.map(() => 1), [1, ids.length]), sid }, ["output"]);
    output = result.output;
  }
  const samples = Float32Array.from(output.data);
  let peak = 0.01;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  const gain = 0.9 / peak;
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  return samples;
}

// One piece at a time: a session runs one request at once.
let queue = Promise.resolve();

self.onmessage = ({ data }) => {
  if (data?.type === "load") {
    loadVoice(data.voice).then(
      () => self.postMessage({ type: "ready", lang: data.voice.lang }),
      (error) => self.postMessage({ type: "error", lang: data.voice.lang, message: String(error?.message ?? error) }),
    );
    return;
  }
  if (data?.type === "speak") {
    queue = queue.then(async () => {
      try {
        const samples = await synthesize(data.voice, data.ids, data.speaker ?? 0, data.lengthScale ?? 1);
        self.postMessage({ type: "audio", id: data.id, samples, sampleRate: data.voice.sampleRate }, [samples.buffer]);
      } catch (error) {
        self.postMessage({ type: "error", id: data.id, message: String(error?.message ?? error) });
      }
    });
  }
};
