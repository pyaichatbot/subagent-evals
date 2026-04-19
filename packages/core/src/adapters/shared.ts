export function extractAgentSections(
  text: string
): Array<{ heading: string; content: string }> {
  const lines = text.split(/\r?\n/);
  const sections: Array<{ heading: string; content: string }> = [];
  let currentHeading: string | null = null;
  const currentLines: string[] = [];

  for (const line of lines) {
    const match = line.match(/^##\s+Agent:\s+(.+)$/i);
    if (match) {
      const heading = match[1];
      if (!heading) {
        continue;
      }
      if (currentHeading !== null) {
        sections.push({
          heading: currentHeading,
          content: currentLines.join("\n").trim()
        });
        currentLines.length = 0;
      }
      currentHeading = heading.trim();
      continue;
    }

    if (currentHeading !== null) {
      currentLines.push(line);
    }
  }

  if (currentHeading !== null) {
    sections.push({
      heading: currentHeading,
      content: currentLines.join("\n").trim()
    });
  }

  return sections.filter((section) => section.content.length > 0);
}
