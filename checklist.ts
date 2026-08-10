import { execSync } from "node:child_process";

// ─── ANSI Colors ─────────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChecklistItem {
  command: string;
  description: string;
}

interface ChecklistResult {
  description: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const checklist: ChecklistItem[] = [
  { command: "npm run lint", description: "Lint & Format" },
  { command: "npm run build", description: "Build" },
  { command: "npm run test", description: "Tests" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function progressBar(current: number, total: number, width = 30): string {
  const pct = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = `${c.green}${"█".repeat(filled)}${c.dim}${"░".repeat(empty)}${c.reset}`;
  return `${bar} ${c.bold}${pct}%${c.reset}`;
}

function spinner(index: number): string {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  return `${c.cyan}${frames[index % frames.length]}${c.reset}`;
}

function header(text: string): void {
  const line = "═".repeat(60);
  console.log(`\n${c.cyan}${line}${c.reset}`);
  console.log(`${c.bold}${c.cyan}  ${text}${c.reset}`);
  console.log(`${c.cyan}${line}${c.reset}\n`);
}

// ─── Runner ──────────────────────────────────────────────────────────────────

function runChecks(items: ChecklistItem[]) {
  const results: ChecklistResult[] = [];
  const total = items.length;

  execSync("clear", { stdio: "inherit" });
  header("Checklist");

  console.log(`  ${c.dim}Running ${total} checks...${c.reset}\n`);

  const globalStart = Date.now();

  for (let i = 0; i < items.length; i++) {
    const { command, description } = items[i];
    const step = `[${i + 1}/${total}]`;

    console.log(`  ${spinner(i)} ${c.blue}${step}${c.reset} ${c.bold}${description}${c.reset}`);
    console.log(`  ${c.dim}$ ${command}${c.reset}\n`);

    const start = Date.now();

    try {
      const output = execSync(command, { encoding: "utf-8" });
      const durationMs = Date.now() - start;

      if (output.trim()) {
        process.stdout.write(`${c.dim}${output}${c.reset}`);
      }

      console.log(
        `\n  ${c.green}✓${c.reset} ${c.bold}${description}${c.reset} ${c.dim}(${formatDuration(durationMs)})${c.reset}`,
      );
      console.log(`  ${progressBar(i + 1, total)}\n`);

      results.push({ description, passed: true, durationMs });
    } catch (err) {
      const durationMs = Date.now() - start;
      const stdout =
        err instanceof Error && "stdout" in err ? String((err as { stdout: unknown }).stdout) : "";
      const stderr =
        err instanceof Error && "stderr" in err ? String((err as { stderr: unknown }).stderr) : "";

      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);

      const error = (stderr || stdout).trim();
      console.log(
        `\n  ${c.red}✗${c.reset} ${c.bold}${c.red}${description}${c.reset} ${c.dim}(${formatDuration(durationMs)})${c.reset}`,
      );
      console.log(`  ${progressBar(i + 1, total)}\n`);

      results.push({ description, passed: false, durationMs, error });
      break;
    }
  }

  const globalDuration = Date.now() - globalStart;

  // ─── Summary ───────────────────────────────────────────────────────────────

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const skipped = items.length - results.length;

  console.log(`\n${c.dim}${"─".repeat(60)}${c.reset}`);
  header("Summary");

  for (const result of results) {
    const icon = result.passed ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
    const name = result.passed
      ? `${c.white}${result.description}${c.reset}`
      : `${c.red}${result.description}${c.reset}`;
    const time = `${c.dim}${formatDuration(result.durationMs)}${c.reset}`;
    console.log(`  ${icon} ${name} ${time}`);

    if (result.error) {
      console.log(
        `\n${c.red}${c.dim}${result.error.split("\n").slice(0, 20).join("\n")}${c.reset}\n`,
      );
    }
  }

  for (let i = results.length; i < items.length; i++) {
    console.log(`  ${c.yellow}○${c.reset} ${c.dim}${items[i].description} (skipped)${c.reset}`);
  }

  console.log(`\n${c.dim}${"─".repeat(60)}${c.reset}`);
  console.log(
    `\n  ${c.bold}Results:${c.reset} ${c.green}${passed} passed${c.reset}` +
      (failed > 0 ? ` ${c.red}${failed} failed${c.reset}` : "") +
      (skipped > 0 ? ` ${c.yellow}${skipped} skipped${c.reset}` : "") +
      ` ${c.dim}in ${formatDuration(globalDuration)}${c.reset}`,
  );

  if (failed === 0) {
    console.log(
      `\n  ${c.bgGreen}${c.bold} PASS ${c.reset} ${c.green}All checks passed!${c.reset}\n`,
    );
  } else {
    console.log(`\n  ${c.bgRed}${c.bold} FAIL ${c.reset} ${c.red}Some checks failed.${c.reset}\n`);
    process.exit(1);
  }
}

runChecks(checklist);
