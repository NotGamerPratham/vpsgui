/**
 * Hand a Blob to the browser as a file save.
 *
 * A plain `<a href>` cannot be used to fetch from the agent: it requires a bearer token on every
 * request and a link sends no headers, so the download would 401. The bytes are therefore fetched
 * with the token attached and handed to a synthetic link here.
 *
 * The object URL is revoked immediately afterwards. Leaving it alive pins the entire file in
 * memory for the lifetime of the tab, which matters when the file is a multi-gigabyte backup.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    // Firefox ignores a click on a link that is not in the document.
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
