import { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import Quill from "quill";
import QuillTableBetter from "quill-table-better";
import "quill/dist/quill.snow.css";
import "quill-table-better/dist/quill-table-better.css";

// react-quill drops tables, so an email body that carries one (the invoice email's invoice table)
// is edited in a raw Quill v2 instance with quill-table-better, like the CGPass template editor.
// Registered only when no other editor has registered table-better yet.
if (!Quill.imports["modules/table-better"]) {
  Quill.register({ "modules/table-better": QuillTableBetter }, true);
  QuillTableBetter.register();
}

const TOOLBAR = [
  ["bold", "italic", "underline"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["link", "image", "table-better"],
  ["clean"],
];

const EmailTableEditor = ({ value, onChange, placeholder = "", readOnly = false }) => {
  const containerRef = useRef(null);
  const quillRef = useRef(null);
  const lastHtmlRef = useRef("");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current || quillRef.current) return undefined;

    const quill = new Quill(containerRef.current, {
      theme: "snow",
      placeholder,
      modules: {
        table: false,
        toolbar: TOOLBAR,
        "table-better": {
          language: "en_US",
          menus: ["column", "row", "merge", "table", "cell", "wrap", "delete"],
          toolbarTable: true,
        },
        keyboard: {
          bindings: QuillTableBetter.keyboardBindings,
        },
      },
    });
    quillRef.current = quill;

    const syncChange = () => {
      const html = quill.root.innerHTML;
      lastHtmlRef.current = html;
      onChangeRef.current(html);
    };
    quill.on(Quill.events.TEXT_CHANGE, syncChange);

    return () => {
      quill.off(Quill.events.TEXT_CHANGE, syncChange);
      // The toolbar and table-better's picker / menus sit outside the container, so they are
      // removed here; left behind, reopening the modal would stack a second set.
      quill.getModule("toolbar")?.container?.remove();
      const tableBetter = quill.getModule("table-better");
      tableBetter?.tableSelect?.root?.remove();
      tableBetter?.tableMenus?.root?.remove();
      quillRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;
    const incoming = value || "";
    if (incoming === lastHtmlRef.current) return;
    lastHtmlRef.current = incoming;
    // setContents(clipboard.convert(...)) keeps only an empty table shell; table-better builds the
    // cells only when the HTML goes in through a paste.
    quill.setContents([], Quill.sources.SILENT);
    quill.clipboard.dangerouslyPasteHTML(0, incoming, Quill.sources.SILENT);
  }, [value]);

  useEffect(() => {
    quillRef.current?.enable(!readOnly);
  }, [readOnly]);

  return (
    <div className="quill">
      <div ref={containerRef} />
    </div>
  );
};

EmailTableEditor.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  readOnly: PropTypes.bool,
};

export default EmailTableEditor;
