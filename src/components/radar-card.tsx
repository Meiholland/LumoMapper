"use client";

import {
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip,
} from "chart.js";
import { Radar } from "react-chartjs-2";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

type Axis = {
  label: string;
  score: number;
};

type Dataset = {
  label: string;
  axes: Axis[];
};

type RadarCardProps = {
  title: string;
  subtitle?: string;
  axes?: Axis[];
  datasets?: Dataset[];
};

const QUARTER_COLORS = [
  { border: "#F6B055", fill: "rgba(246, 176, 85, 0.25)", point: "#F6B055" }, // newest (yellow)
  { border: "#2563EB", fill: "rgba(37, 99, 235, 0.18)", point: "#2563EB" }, // previous (blue)
  { border: "#10B981", fill: "rgba(16, 185, 129, 0.15)", point: "#10B981" }, // older (green)
  { border: "#111827", fill: "rgba(17, 24, 39, 0.12)", point: "#111827" }, // fallback (dark)
];

export function RadarCard({ title, subtitle, axes, datasets }: RadarCardProps) {
  // Support both single dataset (axes) and multiple datasets (for comparison)
  const isMultiDataset = datasets && datasets.length > 0;
  const labels = isMultiDataset
    ? datasets[0].axes.map((a) => a.label)
    : axes?.map((a) => a.label) ?? [];

  const chartDatasets = isMultiDataset
    ? datasets.map((dataset, index) => {
        const color = QUARTER_COLORS[index] ?? QUARTER_COLORS[0];
        return {
          label: dataset.label,
          data: dataset.axes.map((axis) => axis.score),
          borderColor: color.border,
          borderWidth: 2,
          pointBackgroundColor: color.point,
          pointBorderColor: "white",
          pointRadius: 4,
          backgroundColor: color.fill,
        };
      })
    : axes
      ? [
          {
            label: "Score",
            data: axes.map((axis) => axis.score),
            borderColor: "rgb(227, 152, 31)",
            borderWidth: 2,
            pointBackgroundColor: "rgb(246, 191, 85)",
            pointBorderColor: "white",
            pointRadius: 4,
            backgroundColor: "rgba(246, 191, 85, 0.25)",
          },
        ]
      : [];

  const data = {
    labels,
    datasets: chartDatasets,
  };

  const options = {
    scales: {
      r: {
        angleLines: { color: "rgba(148, 163, 184, 0.3)" },
        grid: { color: "rgba(148, 163, 184, 0.2)" },
        suggestedMin: 0,
        suggestedMax: 5,
        ticks: {
          stepSize: 1,
          display: false,
        },
        pointLabels: {
          color: "#0f172a",
          font: {
            size: 11,
            family: "var(--font-geist-sans)",
          },
        },
      },
    },
    plugins: {
      legend: { display: isMultiDataset, position: "bottom" as const },
      tooltip: { enabled: true },
    },
    responsive: true,
    maintainAspectRatio: false,
  } as const;

  return (
    <div className="rounded-3xl border border-slate-100 bg-white/50 p-5 shadow-sm shadow-slate-200/50">
      <div className="mb-4">
        {subtitle ? (
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {subtitle}
          </p>
        ) : null}
        <p className="text-lg font-semibold text-slate-900">{title}</p>
      </div>
      <div className="h-56">
        <Radar data={data} options={options} />
      </div>
    </div>
  );
}

