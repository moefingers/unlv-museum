"use client";

import { useState, useMemo } from "react";

interface StockData {
  symbol: string;
  name: string;
  prices: number[];
  current: number;
  change: number;
}

const STOCKS: StockData[] = [
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    prices: [150, 152, 148, 155, 153, 158, 162, 160, 165, 168, 170, 172],
    current: 172,
    change: 2.4,
  },
  {
    symbol: "GOOGL",
    name: "Alphabet Inc.",
    prices: [130, 132, 128, 135, 133, 131, 136, 140, 138, 142, 145, 143],
    current: 143,
    change: -1.2,
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corp.",
    prices: [320, 325, 318, 330, 335, 328, 340, 345, 350, 348, 355, 360],
    current: 360,
    change: 1.8,
  },
  {
    symbol: "AMZN",
    name: "Amazon.com Inc.",
    prices: [140, 138, 142, 145, 143, 148, 150, 152, 148, 155, 158, 160],
    current: 160,
    change: 3.1,
  },
  {
    symbol: "TSLA",
    name: "Tesla Inc.",
    prices: [220, 230, 215, 240, 235, 225, 245, 250, 238, 255, 260, 248],
    current: 248,
    change: -2.0,
  },
];

function MiniChart({
  prices,
  positive,
}: {
  prices: number[];
  positive: boolean;
}) {
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const height = 40;
  const width = 120;
  const step = width / (prices.length - 1);

  const points = prices
    .map((p, i) => `${i * step},${height - ((p - min) / range) * height}`)
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "#22c55e" : "#ef4444"}
        strokeWidth="2"
      />
    </svg>
  );
}

export function StockCharts() {
  const [selected, setSelected] = useState<string>("AAPL");
  const stock = STOCKS.find((s) => s.symbol === selected)!;

  const chartHeight = 200;
  const chartWidth = 400;

  const fullChart = useMemo(() => {
    const min = Math.min(...stock.prices);
    const max = Math.max(...stock.prices);
    const range = max - min || 1;
    const step = chartWidth / (stock.prices.length - 1);

    const points = stock.prices
      .map(
        (p, i) =>
          `${i * step},${chartHeight - ((p - min) / range) * chartHeight}`,
      )
      .join(" ");

    const fillPoints = `0,${chartHeight} ${points} ${chartWidth},${chartHeight}`;

    return { points, fillPoints, min, max };
  }, [stock]);

  return (
    <div className="flex min-h-[60vh] flex-col p-6">
      <h2 className="mb-4 text-2xl font-bold">Stock Charts</h2>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-1">
          {STOCKS.map((s) => (
            <button
              key={s.symbol}
              onClick={() => setSelected(s.symbol)}
              className={`flex w-full items-center justify-between rounded-lg border p-3 transition-colors ${selected === s.symbol ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950" : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"}`}
            >
              <div>
                <p className="font-bold">{s.symbol}</p>
                <p className="text-xs text-zinc-500">{s.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <MiniChart prices={s.prices} positive={s.change >= 0} />
                <div className="text-right">
                  <p className="font-mono text-sm">${s.current}</p>
                  <p
                    className={`text-xs font-medium ${s.change >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {s.change >= 0 ? "+" : ""}
                    {s.change}%
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-zinc-200 p-6 lg:col-span-2 dark:border-zinc-700">
          <div className="mb-4 flex items-baseline gap-3">
            <h3 className="text-xl font-bold">{stock.symbol}</h3>
            <span className="font-mono text-2xl">${stock.current}</span>
            <span
              className={`text-sm font-medium ${stock.change >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {stock.change >= 0 ? "+" : ""}
              {stock.change}%
            </span>
          </div>
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full"
            preserveAspectRatio="none"
          >
            <polygon
              points={fullChart.fillPoints}
              fill={
                stock.change >= 0
                  ? "rgba(34,197,94,0.1)"
                  : "rgba(239,68,68,0.1)"
              }
            />
            <polyline
              points={fullChart.points}
              fill="none"
              stroke={stock.change >= 0 ? "#22c55e" : "#ef4444"}
              strokeWidth="3"
            />
          </svg>
          <div className="mt-2 flex justify-between text-xs text-zinc-400">
            <span>${fullChart.min}</span>
            <span>${fullChart.max}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
