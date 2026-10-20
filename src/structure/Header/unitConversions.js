// Each unit converts through its category's base unit (kg, m, m³, m/s, °C).
const linear = (id, label, symbol, factor) => ({
  id,
  label,
  symbol,
  toBase: (v) => v * factor,
  fromBase: (v) => v / factor,
});

export const UNIT_CATEGORIES = [
  {
    id: 'weight',
    label: 'Weight',
    units: [
      linear('t', 'Metric ton', 't', 1000),
      linear('kg', 'Kilogram', 'kg', 1),
      linear('lb', 'Pound', 'lb', 0.45359237),
      linear('lt', 'Long ton', 'LT', 1016.0469088),
      linear('st', 'Short ton', 'ST', 907.18474),
    ],
  },
  {
    id: 'length',
    label: 'Length',
    units: [
      linear('m', 'Meter', 'm', 1),
      linear('km', 'Kilometer', 'km', 1000),
      linear('ft', 'Foot', 'ft', 0.3048),
      linear('nmi', 'Nautical mile', 'nmi', 1852),
      linear('mi', 'Mile', 'mi', 1609.344),
    ],
  },
  {
    id: 'volume',
    label: 'Volume',
    units: [
      linear('m3', 'Cubic meter', 'm³', 1),
      linear('l', 'Liter', 'L', 0.001),
      linear('bbl', 'Barrel', 'bbl', 0.158987294928),
      linear('gal', 'US gallon', 'gal', 0.003785411784),
    ],
  },
  {
    id: 'speed',
    label: 'Speed',
    units: [
      linear('kn', 'Knot', 'kn', 1852 / 3600),
      linear('kmh', 'Kilometer/hour', 'km/h', 1 / 3.6),
      linear('ms', 'Meter/second', 'm/s', 1),
      linear('mph', 'Mile/hour', 'mph', 0.44704),
    ],
  },
  {
    id: 'temperature',
    label: 'Temperature',
    shortLabel: 'Temp',
    units: [
      { id: 'c', label: 'Celsius', symbol: '°C', toBase: (v) => v, fromBase: (v) => v },
      { id: 'f', label: 'Fahrenheit', symbol: '°F', toBase: (v) => ((v - 32) * 5) / 9, fromBase: (v) => (v * 9) / 5 + 32 },
      { id: 'k', label: 'Kelvin', symbol: 'K', toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
    ],
  },
];

export const getCategory = (categoryId) => UNIT_CATEGORIES.find((c) => c.id === categoryId) ?? UNIT_CATEGORIES[0];

export const getUnit = (categoryId, unitId) => getCategory(categoryId).units.find((u) => u.id === unitId);

export function convert(value, categoryId, fromId, toId) {
  const from = getUnit(categoryId, fromId);
  const to = getUnit(categoryId, toId);
  if (!from || !to) return NaN;
  return to.fromBase(from.toBase(value));
}
