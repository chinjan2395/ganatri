import type { DailyGameData } from '../mockData';
import { AdminPanel } from './AdminPanel';

interface GamesOverTimeChartProps {
  data: DailyGameData[];
  title?: string;
}

export function GamesOverTimeChart({ data, title = 'Games Over Time' }: GamesOverTimeChartProps) {
  const maxTotal = Math.max(...data.map(d => d.completed + d.abandoned), 1);

  return (
    <AdminPanel
      title={title}
      action={<span className="admin-panel__subtitle">Last 7 Days</span>}
    >
      <div className="admin-chart-legend">
        <span className="admin-chart-legend__item">
          <span className="admin-chart-legend__swatch admin-chart-legend__swatch--completed" />
          Completed
        </span>
        <span className="admin-chart-legend__item">
          <span className="admin-chart-legend__swatch admin-chart-legend__swatch--abandoned" />
          Abandoned
        </span>
      </div>
      <div className="admin__kpi-bar-row admin-chart-bars">
        {data.map(day => {
          const total = day.completed + day.abandoned;
          const completedH = Math.round((day.completed / maxTotal) * 140);
          const abandonedH = Math.round((day.abandoned / maxTotal) * 140);
          return (
            <div className="admin__kpi-bar-group" key={day.date}>
              <span className="admin__kpi-bar-count">{total}</span>
              <div className="admin__kpi-bar admin-chart-bars__stack">
                <div
                  className="admin__kpi-bar-abandoned"
                  style={{ height: `${abandonedH}px` }}
                />
                <div
                  className="admin__kpi-bar-completed"
                  style={{ height: `${completedH}px` }}
                />
              </div>
              <span className="admin__kpi-bar-label">{day.label}</span>
            </div>
          );
        })}
      </div>
    </AdminPanel>
  );
}
