export const helpers = {
  formatDate(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  },
  truncate(str, max = 160) {
    if (!str) return "";
    return str.length > max ? str.slice(0, max) + "…" : str;
  },
  formatQPS(n) {
    return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n);
  },
};