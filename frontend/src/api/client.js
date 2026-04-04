// API client utilities - to be filled in later
export const apiClient = {
  search: async (query) => {
    const res = await fetch(`http://localhost:4000/api/search?q=${encodeURIComponent(query)}`);
    return res.json();
  },
  suggest: async (query) => {
    const res = await fetch(`http://localhost:4000/api/suggest?q=${encodeURIComponent(query)}`);
    return res.json();
  },
};
