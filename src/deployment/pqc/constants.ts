export const TLS_GROUPS = {
  classical: "X25519",
  hybrid: "X25519MLKEM768",
} as const;

export type TlsGroup = (typeof TLS_GROUPS)[keyof typeof TLS_GROUPS];
