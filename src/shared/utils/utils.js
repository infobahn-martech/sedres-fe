import useAlertReducer from '../../store/AlertReducer';

export const stripHtmlTags = (value) => {
  const text = String(value ?? '');
  if (!text) return '';
  return text
    .replace(/<(script|style|head)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

export const getInitials = (fullName) => {
  const nameParts = fullName?.split(' ');
  if (nameParts && nameParts.length > 0) {
    const firstName = nameParts[0];
    const lastName = nameParts[1];
    const initials = (
      firstName.charAt(0) + (lastName ? lastName.charAt(0) : '')
    ).toUpperCase();
    return initials;
  }
};

export function downloadFile({ link, fileName }) {
  if (!link) {
    const { error } = useAlertReducer.getState();
    error('Invalid link provided for download.');
    return; // Exit function if link is invalid
  }
  const url = link;
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url); // Release the object URL
  document.body.removeChild(a); // Remove the anchor element
}

/* Saves a remote file under its own name. The file host is another origin, so the file is fetched as a
   blob first; while the host sends no CORS header the fetch fails, and the plain link is used instead. */
export async function downloadRemoteFile({ url, name }) {
  const fileName = name || decodeURIComponent(url.split('/').pop());
  try {
    const response = await fetch(url);
    if (response.ok) {
      downloadFile({ link: URL.createObjectURL(await response.blob()), fileName });
      return;
    }
  } catch {
    /* Falls back to the plain link below. */
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

