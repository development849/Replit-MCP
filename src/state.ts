let activeReplId: string | undefined;

export function getActiveReplId(): string | undefined {
  return activeReplId;
}

export function setActiveReplId(replId: string): void {
  activeReplId = replId;
}
