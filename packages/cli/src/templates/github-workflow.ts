export interface GitHubWorkflowOptions {
  minScore?: number;
  postComment?: boolean;
}

export function renderGitHubWorkflow(options: GitHubWorkflowOptions): string {
  const postComment = options.postComment !== false;
  const resultsPath = "out/results.json";
  const minScoreCheck = options.minScore !== undefined
    ? `          if (r.summary.score < ${options.minScore}) process.exit(1);`
    : "";

  const commentSteps = postComment ? `
      - name: Generate PR comment
        if: always()
        run: subagent-evals comment --current ${resultsPath} --output comment.md
      - name: Post PR comment
        if: always()
        run: gh pr comment "\${{ github.event.number }}" --body-file comment.md
        env:
          GH_TOKEN: \${{ github.token }}` : "";

  return `name: subagent-evals
on:
  pull_request:
    branches: ["**"]

permissions:
  contents: read
  pull-requests: write
  statuses: write

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - name: Install subagent-evals
        run: npm install -g subagent-evals@latest
      - name: Run eval
        # If subagent-evals.config.yaml is missing, eval auto-discovers agent files.
        # Run \`subagent-evals init\` locally to create one.
        run: subagent-evals eval
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
      - name: Generate badge
        if: always()
        run: subagent-evals badge --input ${resultsPath} --write
      - name: Check threshold
        if: always()
        run: |
          node -e "
            const r = require('./${resultsPath}');
            if (r.summary.badge === 'experimental') process.exit(1);
${minScoreCheck}
          "
${commentSteps}
      - name: Post commit status
        if: always()
        run: |
          STATUS=$(node -e "
            const r=require('./${resultsPath}');
            const state=r.summary.badge==='experimental'?'failure':'success';
            console.log(JSON.stringify({state,description:'subagent-evals: '+r.summary.badge+' (score='+r.summary.score.toFixed(3)+')',context:'subagent-evals'}));
          ")
          curl -s -X POST \\\\
            -H "Authorization: token \${{ github.token }}" \\\\
            -H "Accept: application/vnd.github+json" \\\\
            "https://api.github.com/repos/\${{ github.repository }}/statuses/\${{ github.sha }}" \\\\
            -d "$STATUS"
`;
}
