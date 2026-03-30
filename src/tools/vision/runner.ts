export type VisionAnalyzeInput = {
  imagePath: string;
};

export type VisionAnalyzeOutput = {
  summary: string;
};

export type VisionAnalyze = (input: VisionAnalyzeInput) => Promise<VisionAnalyzeOutput>;
