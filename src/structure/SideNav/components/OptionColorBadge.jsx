import PropTypes from 'prop-types';
import DynamicIcon from './DynamicIcon';
import { normalizeHexColor } from '../../../components/SedresColorPicker/sedresColorPickerConstants';

const BADGE_SIZE = 24;
const GLYPH_SIZE = 14;
const LIGHT_BACKGROUND_LUMINANCE = 0.62;

// Readable glyph colour on top of the option's own colour.
const glyphColorFor = (hex) => {
  const full = String(hex).replace('#', '');
  const channels = full.length === 3 ? full.split('').map((c) => c + c) : full.match(/.{2}/g);
  if (!channels || channels.length < 3) return '#ffffff';
  const [r, g, b] = channels.slice(0, 3).map((c) => parseInt(c, 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > LIGHT_BACKGROUND_LUMINANCE ? '#1a1a1a' : '#ffffff';
};

// Round colour chip with the option's icon (types, stickers, blockers, tags), the same look as
// on the card. The colour comes from the API and is drawn as an SVG fill, so no inline style.
function OptionColorBadge({ colorCode, iconName }) {
  const hex = normalizeHexColor(colorCode);
  const offset = (BADGE_SIZE - GLYPH_SIZE) / 2;
  return (
    <svg width={BADGE_SIZE} height={BADGE_SIZE} viewBox={`0 0 ${BADGE_SIZE} ${BADGE_SIZE}`} aria-hidden>
      <circle cx={BADGE_SIZE / 2} cy={BADGE_SIZE / 2} r={BADGE_SIZE / 2} fill={hex} />
      <DynamicIcon iconKey={iconName} size={GLYPH_SIZE} x={offset} y={offset} color={glyphColorFor(hex)} />
    </svg>
  );
}

OptionColorBadge.propTypes = {
  colorCode: PropTypes.string,
  iconName: PropTypes.string,
};

export default OptionColorBadge;
