export type WebSearchInput = {
  query: string;
};

export type WebSearchOutput = {
  items: Array<{ title: string }>;
};

export type WebSearch = (input: WebSearchInput) => Promise<WebSearchOutput>;
