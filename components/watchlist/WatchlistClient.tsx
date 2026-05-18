'use client';

import { useState } from 'react';
import { TokenGate } from './TokenGate';
import { AddSymbolForm } from './AddSymbolForm';
import { WatchlistTable } from './WatchlistTable';
import type { Watchlist } from '@/types';

export function WatchlistClient({ initial }: { initial: Watchlist[] }) {
  const [rows, setRows] = useState<Watchlist[]>(initial);

  async function reload() {
    const res = await fetch('/api/watchlist', { cache: 'no-store' });
    if (!res.ok) return;
    const j = await res.json();
    setRows(j.rows ?? []);
  }

  return (
    <TokenGate>
      <div className="space-y-4">
        <AddSymbolForm onAdded={() => reload()} />
        <WatchlistTable rows={rows} onChange={reload} />
      </div>
    </TokenGate>
  );
}
