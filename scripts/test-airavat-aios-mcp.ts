import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const projectRoot = path.resolve(path.dirname(path.resolve(process.argv[1])), "..");
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [
    path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs"),
    path.join(projectRoot, "scripts", "airavat-aios-mcp.ts"),
  ],
  stderr: "pipe",
});
const client = new Client({ name: "airavat-aios-smoke-test", version: "1.0.0" });

async function main() {
  await client.connect(transport);

  const tools = await client.listTools();
  const expectedTools = [
    "aios_health",
    "list_enquiries",
    "get_enquiry_brief",
    "list_tasks",
    "search_hotel_catalog",
    "create_follow_up_task",
    "record_enquiry_recommendation",
  ];
  for (const tool of expectedTools) {
    if (!tools.tools.some((candidate) => candidate.name === tool)) {
      throw new Error(`Missing MCP tool: ${tool}`);
    }
  }

  const health = await client.callTool({ name: "aios_health", arguments: {} });
  if (health.isError) throw new Error("AIOS health tool failed.");

  const enquiries = await client.callTool({
    name: "list_enquiries",
    arguments: { limit: 2 },
  });
  if (enquiries.isError) throw new Error("Enquiry list tool failed.");
  const enquiryRows = (
    enquiries.structuredContent as { result?: Array<{ id?: string }> } | undefined
  )?.result;
  if (enquiryRows?.[0]?.id) {
    const brief = await client.callTool({
      name: "get_enquiry_brief",
      arguments: { enquiry: enquiryRows[0].id, include_messages: false },
    });
    if (brief.isError) throw new Error("Enquiry brief tool failed.");
  }

  const tasks = await client.callTool({
    name: "list_tasks",
    arguments: { status: "open", limit: 2 },
  });
  if (tasks.isError) throw new Error("Task list tool failed.");

  const hotels = await client.callTool({
    name: "search_hotel_catalog",
    arguments: { destination: "Nairobi", limit: 2 },
  });
  if (hotels.isError) throw new Error("Hotel catalog tool failed.");

  const confirmationGate = await client.callTool({
    name: "record_enquiry_recommendation",
    arguments: {
      enquiry_id: "00000000-0000-0000-0000-000000000000",
      summary: "Smoke-test recommendation that must never be written.",
      confirm: false,
    },
  });
  if (!confirmationGate.isError) {
    throw new Error("Write confirmation gate did not reject confirm: false.");
  }

  process.stdout.write(
    JSON.stringify(
      {
        status: "passed",
        tools: tools.tools.map((tool) => tool.name),
        checks: [
          "Supabase connection",
          "enquiry list read",
          enquiryRows?.length ? "enquiry brief read" : "enquiry brief skipped (no enquiries)",
          "task list read",
          "approved hotel catalog read",
          "write confirmation gate",
        ],
      },
      null,
      2,
    ) + "\n",
  );
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.close();
  });
