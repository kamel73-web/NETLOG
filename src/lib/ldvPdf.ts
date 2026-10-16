/**
 * Export PDF côté navigateur. Bibliothèques chargées à la demande (≈ 200 Ko gzip)
 * pour ne pas alourdir le chargement initial sur 3G.
 * html2canvas rend le DOM réel : l'arabe et les noms accentués sont corrects.
 */
export async function exportElementToPdf(el: HTMLElement, filename: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const scale = Math.min(2, Math.max(1.5, window.devicePixelRatio || 1.5));
  const canvas = await html2canvas(el, {
    scale,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    width: 794,
    height: 1123,
    windowWidth: 794,
  });
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, 210, 297, undefined, "FAST");
  pdf.save(filename.replace(/[^A-Za-z0-9_.-]/g, "_"));
}
