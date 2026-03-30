export type WebSearchInput = {
  query: string;
};

export type WebSearchOutput = {
  items: Array<{ title: string }>;
};

export type WebSearch = (input: WebSearchInput) => Promise<WebSearchOutput>;

export type WebFetchInput = {
  url: string;
};

export type WebFetchOutput = {
  url: string;
  text: string;
};

export type WebFetch = (input: WebFetchInput) => Promise<WebFetchOutput>;
