import { PDFDocument } from "pdf-lib";

/**
 * Merge multiple PDFs (base64-encoded) into a single PDF.
 * Returns the merged PDF as a base64 string.
 */
export async function mergePdfs(
  pdfBuffers: { pdfBase64: string; documentType: string }[]
): Promise<string> {
  const merged = await PDFDocument.create();

  for (const { pdfBase64 } of pdfBuffers) {
    const bytes = Buffer.from(pdfBase64, "base64");
    const doc = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const page of pages) {
      merged.addPage(page);
    }
  }

  const mergedBytes = await merged.save();
  return Buffer.from(mergedBytes).toString("base64");
}
