import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import '../../../design/scss/pages/kpi-dashboard/components/MonthlyTasksChart.scss';

const MonthlyTasksChart = () => {
  const data = [
    { name: 'Import Call', value: 45, color: '#0075FF' },
    { name: 'Export Call', value: 35, color: '#4ADE80' },
    { name: 'Sailing Report', value: 30, color: '#F87171' },
    { name: 'Outward Clearance', value: 25, color: '#A78BFA' },
    { name: 'Vessel Inward', value: 20, color: '#60A5FA' },
    { name: 'Email Request', value: 15, color: '#FFE100' },
  ];

  return (
    <div className="kpi-monthly-tasks-chart">
      <div className="kpi-monthly-tasks-chart__header">
        <h3 className="kpi-monthly-tasks-chart__title">Monthly Tasks</h3>
      </div>
      <div className="kpi-monthly-tasks-chart__chart">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
            <XAxis
              dataKey="name"
              stroke="rgba(255, 255, 255, 0.7)"
              tick={{ fill: 'rgba(255, 255, 255, 0.7)', fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              stroke="rgba(255, 255, 255, 0.7)"
              tick={{ fill: 'rgba(255, 255, 255, 0.7)', fontSize: 12 }}
              domain={[0, 50]}
              ticks={[0, 10, 20, 30, 40, 50]}
            />
            <Tooltip
              cursor={false}
              contentStyle={{
                backgroundColor: 'rgba(26, 31, 55, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#FFF'
              }}
            />

            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="kpi-monthly-tasks-chart__legend">
        {data.map((item, index) => (
          <div key={index} className="kpi-monthly-tasks-chart__legend-item">
            <div
              className="kpi-monthly-tasks-chart__legend-color"
              style={{ backgroundColor: item.color }}
            ></div>
            <span>{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MonthlyTasksChart;

