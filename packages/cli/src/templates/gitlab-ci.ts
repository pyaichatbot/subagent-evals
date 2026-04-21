export interface GitLabCiOptions {
  minScore?: number;
  postComment?: boolean;
  gitlabUrl?: string;
}

export function renderGitLabCi(options: GitLabCiOptions): string {
  const postComment = options.postComment !== false;
  const resultsPath = "out/results.json";
  const apiBase = options.gitlabUrl
    ? `${options.gitlabUrl.replace(/\/$/, "")}/api/v4`
    : "\${CI_API_V4_URL}";

  const minScoreCheck = options.minScore !== undefined
    ? `    - node -e "const r=require('./${resultsPath}'); if(r.summary.score<${options.minScore}) process.exit(1);"`
    : "";

  const commentStep = postComment ? `
    - subagent-evals comment --current ${resultsPath} --output comment.md
    - |
      BODY=$(cat comment.md | python3 -c "import sys,json; print(json.dumps({'body': sys.stdin.read()}))")
      curl -s --request POST \\
        --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \\
        --header "Content-Type: application/json" \\
        "${apiBase}/projects/\${CI_PROJECT_ID}/merge_requests/\${CI_MERGE_REQUEST_IID}/notes" \\
        --data "$BODY"` : "";

  return `subagent-evals:
  image: node:20
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script:
    - npm install -g subagent-evals@latest
    # If subagent-evals.config.yaml is missing, eval auto-discovers agent files.
    - subagent-evals eval
    - subagent-evals badge --input ${resultsPath} --write
    - node -e "const r=require('./${resultsPath}'); if(r.summary.badge==='experimental') process.exit(1);"
${minScoreCheck}${commentStep}
  variables:
    ANTHROPIC_API_KEY: ""   # set in GitLab CI/CD Variables (Settings > CI/CD > Variables)
    GITLAB_TOKEN: ""        # set in GitLab CI/CD Variables; needs api scope
  allow_failure: false
`;
}
