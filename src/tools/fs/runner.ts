export type FsReadInput = {
  path: string;
};

export type FsReadOutput = {
  path: string;
  content: string;
};

export type FsRead = (input: FsReadInput) => Promise<FsReadOutput>;

export type FsWriteInput = {
  path: string;
  content: string;
};

export type FsWriteOutput = {
  path: string;
  bytesWritten: number;
};

export type FsWrite = (input: FsWriteInput) => Promise<FsWriteOutput>;
