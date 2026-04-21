import { describe, expect, it } from "vitest";
import { renderGitHubWorkflow } from "../src/templates/github-workflow.js";
import { renderGitLabCi } from "../src/templates/gitlab-ci.js";

describe("renderGitHubWorkflow", () => {
  it("contains required permissions block", () => {
    const yaml = renderGitHubWorkflow({});
    expect(yaml).toContain("pull-requests: write");
    expect(yaml).toContain("statuses: write");
  });

  it("injects min-score check when flag provided", () => {
    const yaml = renderGitHubWorkflow({ minScore: 0.75 });
    expect(yaml).toContain("0.75");
    expect(yaml).toContain("r.summary.score");
  });

  it("omits min-score check when flag absent", () => {
    const yaml = renderGitHubWorkflow({});
    expect(yaml).not.toContain("r.summary.score <");
  });

  it("omits post-comment step when --no-post-comment", () => {
    const yaml = renderGitHubWorkflow({ postComment: false });
    expect(yaml).not.toContain("gh pr comment");
  });
});

describe("renderGitLabCi", () => {
  it("uses merge_request_event rule", () => {
    const yaml = renderGitLabCi({});
    expect(yaml).toContain('CI_PIPELINE_SOURCE == "merge_request_event"');
  });

  it("uses custom gitlab url when provided", () => {
    const yaml = renderGitLabCi({ gitlabUrl: "https://git.company.com" });
    expect(yaml).toContain("https://git.company.com/api/v4");
  });

  it("defaults to CI_API_V4_URL when no gitlabUrl", () => {
    const yaml = renderGitLabCi({});
    expect(yaml).toContain("CI_API_V4_URL");
  });
});
