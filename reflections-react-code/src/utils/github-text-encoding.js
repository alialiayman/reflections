/** UTF-8 → base64 for GitHub Contents API bodies */
export function utf8ToBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

/** GitHub API `content` field → UTF-8 string */
export function githubBase64ToUtf8(b64) {
  const clean = String(b64 || "").replace(/\s+/g, "");
  const bin = window.atob(clean);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}
