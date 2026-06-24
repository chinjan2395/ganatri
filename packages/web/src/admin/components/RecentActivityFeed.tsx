import type { ActivityItem } from '../mockData';
import { AdminPanel } from './AdminPanel';

interface RecentActivityFeedProps {
  items: ActivityItem[];
}

const TYPE_ICONS: Record<ActivityItem['type'], string> = {
  join: '👤',
  start: '▶',
  complete: '✓',
  leave: '↩',
};

export function RecentActivityFeed({ items }: RecentActivityFeedProps) {
  return (
    <AdminPanel title="Recent Activity">
      <ul className="admin-activity">
        {items.map(item => (
          <li key={item.id} className="admin-activity__item">
            <span className="admin-activity__icon">{TYPE_ICONS[item.type]}</span>
            <span className="admin-activity__text">{item.text}</span>
            <span className="admin-activity__time">{item.time}</span>
          </li>
        ))}
      </ul>
    </AdminPanel>
  );
}
