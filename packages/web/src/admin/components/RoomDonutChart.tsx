import { AdminPanel } from './AdminPanel';

interface DonutData {
  total: number;
  segments: Array<{ label: string; value: number; percent: number; color: string }>;
}

interface RoomDonutChartProps {
  data: DonutData;
}

export function RoomDonutChart({ data }: RoomDonutChartProps) {
  let cumulative = 0;
  const stops = data.segments.map(seg => {
    const start = cumulative;
    cumulative += seg.percent;
    return `${seg.color} ${start}% ${cumulative}%`;
  });

  return (
    <AdminPanel title="Room Distribution">
      <div className="admin-donut">
        <div
          className="admin-donut__ring"
          style={{ background: `conic-gradient(${stops.join(', ')})` }}
        >
          <div className="admin-donut__center">
            <span className="admin-donut__total">{data.total}</span>
            <span className="admin-donut__label">Total Rooms</span>
          </div>
        </div>
        <ul className="admin-donut__legend">
          {data.segments.map(seg => (
            <li key={seg.label} className="admin-donut__legend-item">
              <span className="admin-donut__swatch" style={{ background: seg.color }} />
              <span className="admin-donut__legend-label">{seg.label}</span>
              <span className="admin-donut__legend-pct">{seg.percent}%</span>
            </li>
          ))}
        </ul>
      </div>
    </AdminPanel>
  );
}
