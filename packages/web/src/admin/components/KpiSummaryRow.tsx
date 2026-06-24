import type { KpiCardData } from '../mockData';
import { KpiSummaryCard } from './KpiSummaryCard';

interface KpiSummaryRowProps {
  cards: KpiCardData[];
}

export function KpiSummaryRow({ cards }: KpiSummaryRowProps) {
  return (
    <div className="admin-dash__kpis">
      {cards.map(card => (
        <KpiSummaryCard key={card.label} data={card} />
      ))}
    </div>
  );
}
