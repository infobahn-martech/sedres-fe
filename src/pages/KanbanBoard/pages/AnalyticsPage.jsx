import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { FiArrowLeft, FiTrendingUp, FiTrendingDown, FiBarChart2 } from 'react-icons/fi';
import '../../../design/scss/pages/kanban-board/analytics.scss';

const COLORS = ['#0075FF', '#00C853', '#FF6B00', '#E91E63', '#9C27B0', '#FFC107'];

const Analytics = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState('7d');

  // Mock data - in real app, fetch based on board ID
  const cardStats = {
    total: 126,
    completed: 89,
    inProgress: 24,
    pending: 13,
    overdue: 5
  };

  const columnDistribution = [
    { name: 'Ready to Finalize', value: 18, color: '#E2106C' },
    { name: 'In Progress', value: 36, color: '#7915BC' },
    { name: 'Al Gihaz awaiting', value: 18, color: '#3E5EBD' },
    { name: 'Finalized', value: 18, color: '#41B24A' },
    { name: 'Awaiting acknowledgment', value: 18, color: '#775649' },
    { name: 'Dispatched', value: 18, color: '#ED8E37' },
  ];

  const weeklyData = [
    { name: 'Mon', completed: 12, created: 8, moved: 15 },
    { name: 'Tue', completed: 15, created: 10, moved: 18 },
    { name: 'Wed', completed: 18, created: 12, moved: 20 },
    { name: 'Thu', completed: 14, created: 9, moved: 16 },
    { name: 'Fri', completed: 20, created: 14, moved: 22 },
    { name: 'Sat', completed: 8, created: 5, moved: 10 },
    { name: 'Sun', completed: 2, created: 3, moved: 4 },
  ];

  const performanceData = [
    { name: 'Week 1', avgTime: 2.5, completion: 65 },
    { name: 'Week 2', avgTime: 2.8, completion: 72 },
    { name: 'Week 3', avgTime: 2.3, completion: 78 },
    { name: 'Week 4', avgTime: 2.1, completion: 85 },
  ];

  const statusTrend = [
    { name: 'Jan', completed: 45, inProgress: 30, pending: 25 },
    { name: 'Feb', completed: 52, inProgress: 28, pending: 20 },
    { name: 'Mar', completed: 58, inProgress: 25, pending: 17 },
    { name: 'Apr', completed: 65, inProgress: 22, pending: 13 },
    { name: 'May', completed: 72, inProgress: 20, pending: 8 },
    { name: 'Jun', completed: 89, inProgress: 24, pending: 13 },
  ];

  const completionRate = ((cardStats.completed / cardStats.total) * 100).toFixed(1);
  const inProgressRate = ((cardStats.inProgress / cardStats.total) * 100).toFixed(1);

  const statsCards = [
    {
      id: 1,
      title: 'Total Cards',
      value: cardStats.total,
      change: '+12%',
      isPositive: true,
      icon: FiBarChart2,
      color: '#0075FF'
    },
    {
      id: 2,
      title: 'Completed',
      value: cardStats.completed,
      change: `+${completionRate}%`,
      isPositive: true,
      icon: FiBarChart2,
      color: '#00C853'
    },
    {
      id: 3,
      title: 'In Progress',
      value: cardStats.inProgress,
      change: `+${inProgressRate}%`,
      isPositive: true,
      icon: FiBarChart2,
      color: '#FF6B00'
    },
    {
      id: 4,
      title: 'Overdue',
      value: cardStats.overdue,
      change: '-8%',
      isPositive: false,
      icon: FiBarChart2,
      color: '#E91E63'
    },
  ];

  const handleBack = () => {
    navigate(`/kanban-board/${id || ''}`);
  };

  return (
    <div className="kanban-analytics">
      <div className="kanban-analytics-header">
        <button className="back-button" onClick={handleBack}>
          <FiArrowLeft /> Back to Board
        </button>
        <div className="header-content">
          <h1>Board Analytics</h1>
          <div className="time-range-selector">
            <button 
              className={timeRange === '7d' ? 'active' : ''} 
              onClick={() => setTimeRange('7d')}
            >
              7 Days
            </button>
            <button 
              className={timeRange === '30d' ? 'active' : ''} 
              onClick={() => setTimeRange('30d')}
            >
              30 Days
            </button>
            <button 
              className={timeRange === '90d' ? 'active' : ''} 
              onClick={() => setTimeRange('90d')}
            >
              90 Days
            </button>
          </div>
        </div>
      </div>

      <div className="kanban-analytics-content">
        {/* Stats Cards */}
        <div className="stats-cards-grid">
          {statsCards.map((card) => {
            const IconComponent = card.icon;
            return (
              <div key={card.id} className="stat-card" style={{ borderTopColor: card.color }}>
                <div className="stat-card-header">
                  <span className="stat-icon">
                    <IconComponent size={32} />
                  </span>
                  <span className={`stat-change ${card.isPositive ? 'positive' : 'negative'}`}>
                    {card.isPositive ? <FiTrendingUp /> : <FiTrendingDown />}
                    {card.change}
                  </span>
                </div>
                <div className="stat-value">{card.value}</div>
                <div className="stat-title">{card.title}</div>
              </div>
            );
          })}
        </div>

        {/* Charts Row 1 */}
        <div className="charts-row">
          <div className="chart-card">
            <h3>Column Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={columnDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {columnDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3>Weekly Activity</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" fill="#00C853" name="Completed" />
                <Bar dataKey="created" fill="#0075FF" name="Created" />
                <Bar dataKey="moved" fill="#FF6B00" name="Moved" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="charts-row">
          <div className="chart-card">
            <h3>Performance Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="avgTime" 
                  stroke="#0075FF" 
                  name="Avg Time (days)"
                  strokeWidth={2}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="completion" 
                  stroke="#00C853" 
                  name="Completion %"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3>Status Trend (Last 6 Months)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={statusTrend}>
                <defs>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00C853" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#00C853" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorInProgress" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#FF6B00" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E91E63" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#E91E63" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="completed" 
                  stackId="1" 
                  stroke="#00C853" 
                  fill="url(#colorCompleted)"
                  name="Completed"
                />
                <Area 
                  type="monotone" 
                  dataKey="inProgress" 
                  stackId="1" 
                  stroke="#FF6B00" 
                  fill="url(#colorInProgress)"
                  name="In Progress"
                />
                <Area 
                  type="monotone" 
                  dataKey="pending" 
                  stackId="1" 
                  stroke="#E91E63" 
                  fill="url(#colorPending)"
                  name="Pending"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
