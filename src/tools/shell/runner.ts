export type ShellExecInput = {
  command: string;
};

export type ShellExecOutput = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type ShellExec = (input: ShellExecInput) => Promise<ShellExecOutput>;
