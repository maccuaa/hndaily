/** A Hacker News story candidate for inclusion in a Digest. */
export interface Story {
  hnId: number;
  title: string;
  /** External URL, or null for a self-post (Ask HN, text post) — link to the HN discussion instead. */
  url: string | null;
  points: number;
  numComments: number;
  /** Unix seconds. */
  createdAt: number;
}
