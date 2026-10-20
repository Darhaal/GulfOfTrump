import "server-only";

/** The page the system browser shows after a sign-in from the desktop app, in the three languages. */
export function appReturnPage(ok: boolean): string {
  const lines = ok
    ? ["Signed in. Close this tab and go back to Gulf of Trump.", "Вход выполнен. Закройте вкладку и вернитесь в Gulf of Trump.", "Вхід виконано. Закрийте вкладку й поверніться до Gulf of Trump."]
    : ["Sign-in did not finish. Go back to Gulf of Trump and try again.", "Вход не завершён. Вернитесь в Gulf of Trump и попробуйте снова.", "Вхід не завершено. Поверніться до Gulf of Trump і спробуйте знову."];
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gulf of Trump</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#F8FAFC;color:#1A1F26}main{max-width:32rem;padding:2rem}h1{font-size:1.25rem;margin:0 0 1rem;color:${ok ? "#C2410C" : "#9e1316"}}p{margin:.5rem 0;line-height:1.5}</style></head><body><main><h1>Gulf of Trump</h1>${lines.map((l) => `<p>${l}</p>`).join("")}</main></body></html>`;
}
