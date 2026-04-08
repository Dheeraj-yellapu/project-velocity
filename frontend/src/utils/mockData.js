export const MOCK_RESULTS = [
  { url: "[https://theguardian.com/housing-2016](https://theguardian.com/housing-2016)", title: "Five steps to fixing the UK housing crisis in 2016", type: "Politics", pub: "2016-01-01T00:00:00Z", lang: "en", sum: "Headlines about the utter madness of our housing market dominated 2015. It's time to make some new year's resolutions...", body: "Perhaps in years to come 2015 will be remembered as the year the housing crisis went mainstream. My fellow housing and economics journalists have been wailing like Cassandra for years now..." },
  { url: "[https://bbc.com/news/uk-housing-market-slowdown](https://bbc.com/news/uk-housing-market-slowdown)", title: "UK housing market sees unexpected slowdown", type: "Economy", pub: "2024-03-15T00:00:00Z", lang: "en", sum: "The UK housing market has shown signs of cooling as interest rates remain high. House prices in several regions have plateaued...", body: "House prices in several regions have plateaued, with buyers becoming more cautious. Experts suggest this could be a turning point..." },
  { url: "[https://ft.com/content/uk-housing-approach](https://ft.com/content/uk-housing-approach)", title: "Why the UK needs a new approach to housing", type: "Housing", pub: "2024-02-10T00:00:00Z", lang: "en", sum: "Britain's housing crisis demands bold solutions. After decades of underbuilding, local councils, housing associations, and the private sector must work together...", body: "Local councils, housing associations, and the private sector must work together to deliver affordable homes..." },
  { url: "[https://independent.co.uk/housing-policy](https://independent.co.uk/housing-policy)", title: "Housing policy reform: what the experts say", type: "Society", pub: "2024-01-20T00:00:00Z", lang: "en", sum: "A panel of economists and urban planners share their views on what it will take to fix Britain's chronic housing shortage...", body: "The shortage of affordable housing continues to be one of the most pressing social issues in Britain today..." },
];

export const MOCK_SUGGESTIONS = ["housing crisis uk", "housing policy reforms", "affordable housing uk", "london rent prices"];

export const ADMIN_CODE = "velocity2024";

export const QPS_DATA = [980, 1020, 1100, 1050, 990, 1080, 1150, 1200, 1180, 1247, 1190, 1210, 1247, 1230, 1247];
export const LAT_DATA = [120, 138, 145, 130, 155, 142, 138, 150, 142, 145, 140, 148, 142, 139, 142];

export const TOP_QUERIES = [
  { q: "housing crisis uk", count: 12543, lat: 120 },
  { q: "interest rates", count: 8921, lat: 98 },
  { q: "inflation 2024", count: 6231, lat: 110 },
  { q: "election results", count: 4567, lat: 130 },
  { q: "energy prices", count: 3210, lat: 95 },
];

export const HEATMAP_DATA = (() => {
  const hours = ["12 AM", "6 AM", "12 PM", "6 PM"];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return hours.map(h => days.map(d => Math.floor(Math.random() * 100)));
})();