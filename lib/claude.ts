// Claude configuration shared by the server routes. No secrets here.

/** Single place to change the Claude model. */
export const CLAUDE_MODEL = "claude-opus-5-5";

/** Parsing and explaining are short extraction/summary tasks: keep latency low. */
export const CLAUDE_EFFORT = "low" as const;
