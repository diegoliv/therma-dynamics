export function createDefaultScrollSections(durationSeconds) {
  return [
    { id: "intro", heightVh: 100, from: 0, to: 1.5 },
    { id: "thermal-build", heightVh: 200, from: 1.5, to: 4 },
    { id: "airflow", heightVh: 150, from: 4, to: 6 },
    { id: "final", heightVh: 200, from: 6, to: durationSeconds },
  ];
}

export function clampTime(value, durationSeconds) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(Math.max(number, 0), durationSeconds);
}

export function normalizeScrollSections(sections, durationSeconds) {
  return (sections ?? [])
    .map((section, index) => ({
      id: section.id || `section-${index + 1}`,
      selector: section.selector,
      heightVh: Number(section.heightVh) || 100,
      start: section.start,
      end: section.end,
      from: clampTime(section.from, durationSeconds),
      to: clampTime(section.to, durationSeconds),
    }))
    .filter((section) => section.to !== section.from);
}

export function timelineTimeForSectionProgress(section, progress) {
  return section.from + ((section.to - section.from) * Math.min(Math.max(progress, 0), 1));
}
