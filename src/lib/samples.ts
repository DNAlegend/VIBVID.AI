// Stand-in "generated" outputs for the simulated generator.
// Small clips + branded gradient posters served locally from /public/samples,
// so the demo never depends on a flaky external host. The real BytePlus output
// URL drops into the same `video` field later.

interface Sample {
  video: string;
  poster: string;
}

export const SAMPLES: Sample[] = [
  { video: "/samples/clip1.mp4", poster: "/samples/poster1.svg" },
  { video: "/samples/clip2.mp4", poster: "/samples/poster2.svg" },
  { video: "/samples/clip3.mp4", poster: "/samples/poster3.svg" },
  { video: "/samples/clip4.mp4", poster: "/samples/poster4.svg" },
];

/** Pick a sample, varied by an incrementing index so results don't all look the same. */
export function pickSample(index: number): Sample {
  return SAMPLES[index % SAMPLES.length];
}
