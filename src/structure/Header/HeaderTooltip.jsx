import { createPortal } from 'react-dom';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';

// The header is its own stacking context (z-index 100), so tooltips rendered inside it slip
// behind page content stacked higher (e.g. map panes/controls). Portal them to <body> instead.
function HeaderTooltip(props) {
  return createPortal(
    <Tooltip positionStrategy="fixed" style={{ zIndex: 2000 }} {...props} />,
    document.body
  );
}

export default HeaderTooltip;
