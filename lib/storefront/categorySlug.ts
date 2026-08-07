// Category pages use the existing free-text Product.category string,
// slugified for the URL -- there is no separate Category model (see
// docs/ProductRoadmap.md's note that `category` is a plain string, not a
// relation), and introducing one isn't necessary just to get stable,
// crawlable category URLs.
export function categoryToSlug(category: string): string {
  return category
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
