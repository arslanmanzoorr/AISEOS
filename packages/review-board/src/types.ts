export interface ReviewFile {
  path: string;
  content: string;
}

export interface PullRequest {
  files: ReviewFile[];
  description?: string;
}

export type VoteValue = "approve" | "reject";

export interface Vote {
  name: string; // agent name
  vote: VoteValue;
  recommendations: string[];
}

export interface BoardResult {
  approved: boolean; // true only when no agent rejects
  votes: Vote[];
}

export interface ReviewAgent {
  name: string;
  review(pr: PullRequest): Vote | Promise<Vote>;
}
