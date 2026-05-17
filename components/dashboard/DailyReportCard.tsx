import { Card } from '@/components/ui/Card';
import type { DashboardDailyReport } from '@/types';

interface Props { report: DashboardDailyReport; }

export function DailyReportCard({ report }: Props) {
  const sections = [
    { label: '市场概况', text: report.market_summary },
    { label: '美股',     text: report.us_summary },
    { label: 'ETF',      text: report.etf_summary },
    { label: 'A股板块',  text: report.cn_sector_summary },
    { label: '定投',     text: report.dca_suggestion },
    { label: '风险',     text: report.risk_summary },
  ];

  return (
    <Card>
      <h2 className="text-base font-bold text-[var(--text)] mb-4 tracking-tight">
        每日复盘 <span className="text-sm font-normal text-[var(--muted)] ml-1">· {report.trade_date}</span>
      </h2>
      <div className="space-y-3.5">
        {sections.map(({ label, text }) => (
          <div key={label} className="flex gap-3">
            <span className="flex-shrink-0 text-sm font-semibold text-indigo-400 w-16 pt-0.5">{label}</span>
            <p className="text-sm text-[var(--muted)] leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
