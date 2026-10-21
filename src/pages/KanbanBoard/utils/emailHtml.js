// The table editor's quill-table-better keeps the table's attributes on a <temporary> element
// inside the table; it is editor-only markup, so it is left out of the HTML the email is sent with.
export const getEmailHtml = (html) => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("temporary").forEach((node) => node.remove());
  return doc.body.innerHTML;
};
