import { PDFDocument } from "pdf-lib";

/* Lossless PDF re-save with object streams: text, fonts and images are kept as they are, so the
   backend can still read the file. The original is returned when the result is not smaller or
   the PDF cannot be parsed (encrypted, corrupt). */
const MIN_COMPRESS_SIZE = 1024 * 1024;

export const compressPdfFile = async (file) => {
  /* Small PDFs gain next to nothing from a re-save, so they skip the parse and go as they are. */
  if (file.size < MIN_COMPRESS_SIZE) return file;
  try {
    const source = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
    const bytes = await source.save({ useObjectStreams: true });
    if (bytes.length >= file.size) return file;
    return new File([bytes], file.name, { type: file.type, lastModified: file.lastModified });
  } catch {
    return file;
  }
};

export const compressPdfFiles = (files) =>
  Promise.all(files.map((file) => (file.type === "application/pdf" ? compressPdfFile(file) : file)));
