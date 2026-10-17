import { zipSync } from "fflate";

/* Names inside a zip must be unique, so a repeated file name gets " (2)", " (3)" ... before its extension. */
const getUniqueName = (name, usedNames) => {
  if (!usedNames.has(name)) return name;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";
  let count = 2;
  while (usedNames.has(`${base} (${count})${extension}`)) count += 1;
  return `${base} (${count})${extension}`;
};

/* Zips the given File objects in the browser and saves the result as zipName. PDFs are already compressed,
   so they are stored as they are (level 0). */
export const downloadFilesAsZip = async (files, zipName) => {
  const buffers = await Promise.all(files.map((file) => file.arrayBuffer()));
  const usedNames = new Set();
  const zipEntries = {};
  files.forEach((file, index) => {
    const name = getUniqueName(file.name, usedNames);
    usedNames.add(name);
    zipEntries[name] = new Uint8Array(buffers[index]);
  });

  const blob = new Blob([zipSync(zipEntries, { level: 0 })], { type: "application/zip" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = zipName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
};
