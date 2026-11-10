import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import '../../../design/scss/pages/kpi-dashboard/components/ImportExportCallChart.scss';

const ImportExportCallChart = () => {
  const data = [
    { day: 20, import: 120, export: 80 },
    { day: 21, import: 150, export: 100 },
    { day: 22, import: 180, export: 130 },
    { day: 23, import: 200, export: 150 },
    { day: 24, import: 220, export: 170 },
    { day: 25, import: 240, export: 190 },
    { day: 26, import: 200, export: 160 },
    { day: 27, import: 180, export: 140 },
    { day: 28, import: 160, export: 120 },
    { day: 29, import: 140, export: 100 },
    { day: 30, import: 160, export: 110 },
    { day: 31, import: 180, export: 130 },
  ];

  return (
    <div className="kpi-import-export-chart">
      <div className="kpi-import-export-chart__header">
        <h3 className="kpi-import-export-chart__title">Import & Export Call</h3>
        <p className="kpi-import-export-chart__subtitle">in October 2025</p>
      </div>
      <div className="kpi-import-export-chart__chart">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorImport" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0075FF" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#0075FF" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorExport" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#60A5FA" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
            <XAxis
              dataKey="day"
              stroke="rgba(255, 255, 255, 0.7)"
              tick={{ fill: 'rgba(255, 255, 255, 0.7)', fontSize: 12 }}
            />
            <YAxis
              stroke="rgba(255, 255, 255, 0.7)"
              tick={{ fill: 'rgba(255, 255, 255, 0.7)', fontSize: 12 }}
              domain={[0, 250]}
              ticks={[0, 50, 100, 150, 200, 250]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(26, 31, 55, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#FFF'
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="circle"
              formatter={(value) => <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>{value}</span>}
            />
            <Area
              type="monotone"
              dataKey="import"
              stroke="#0075FF"
              fillOpacity={1}
              fill="url(#colorImport)"
              strokeWidth={2}
              dot={{ fill: '#0075FF', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Area
              type="monotone"
              dataKey="export"
              stroke="#60A5FA"
              fillOpacity={1}
              fill="url(#colorExport)"
              strokeWidth={2}
              dot={{ fill: '#60A5FA', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="kpi-import-export-chart__legend">
        <div className="kpi-import-export-chart__legend-item">
          <div className="kpi-import-export-chart__legend-color kpi-import-export-chart__legend-color--import"></div>
          <span>Import Call</span>
        </div>
        <div className="kpi-import-export-chart__legend-item">
          <div className="kpi-import-export-chart__legend-color kpi-import-export-chart__legend-color--export"></div>
          <span>Export Call</span>
        </div>
      </div>
    </div>
  );
};

export default ImportExportCallChart;

