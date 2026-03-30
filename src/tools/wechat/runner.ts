export type WechatReplyInput = {
  toUserId: string;
  text: string;
};

export type WechatReplyOutput = {
  delivered: boolean;
};

export type WechatReply = (input: WechatReplyInput) => Promise<WechatReplyOutput>;
