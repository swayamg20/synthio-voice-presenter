import type { ChatCompletionTool } from "openai/resources/chat/completions";
import slides from "./slides";

export type ToolResult =
  | { type: "navigation"; navigateTo: number }
  | { type: "highlight"; zoneId: string }
  | { type: "respond"; spokenText: string; followUps: string[]; expertiseAssessment: string };

// Tool arguments arrive from model-generated JSON, so this public boundary is intentionally loose.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolHandler = (args: Record<string, any>) => ToolResult;
type ToolArgs = Parameters<ToolHandler>[0];

const slideIds = slides.map((slide) => slide.id);
const zoneIds = slides.flatMap((slide) => slide.zones.map((zone) => zone.id));

function requireIntegerArg(
  args: ToolArgs,
  key: string,
  allowedValues: number[],
): number {
  const value = args[key];

  if (!Number.isInteger(value) || !allowedValues.includes(value)) {
    throw new Error(
      `Invalid ${key}. Expected one of: ${allowedValues.join(", ")}.`,
    );
  }

  return value;
}

function requireStringArg(
  args: ToolArgs,
  key: string,
  allowedValues: string[],
): string {
  const value = args[key];

  if (typeof value !== "string" || !allowedValues.includes(value)) {
    throw new Error(
      `Invalid ${key}. Expected one of: ${allowedValues.join(", ")}.`,
    );
  }

  return value;
}

export const toolRegistry: Record<string, ToolHandler> = {
  navigate_to_slide: (args) => ({
    type: "navigation",
    navigateTo: requireIntegerArg(args, "slide_number", slideIds),
  }),
  highlight_zone: (args) => ({
    type: "highlight",
    zoneId: requireStringArg(args, "zone_id", zoneIds),
  }),
  respond: (args) => ({
    type: "respond" as const,
    spokenText: args.spoken_text as string,
    followUps: (args.follow_ups as string[]) || [],
    expertiseAssessment: args.expertise_assessment as string,
  }),
};

const respondToolDefinition: ChatCompletionTool = {
  type: "function",
  function: {
    name: "respond",
    description: "Use this tool to deliver your spoken response to the audience. You MUST call this tool for every response. Include follow-up questions and your assessment of the audience's expertise level.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        spoken_text: {
          type: "string",
          description: "The exact words to speak aloud via TTS. Natural, conversational language. No markdown, no metadata."
        },
        follow_ups: {
          type: "array",
          items: { type: "string" },
          description: "2-3 short contextual follow-up questions the audience might want to ask next."
        },
        expertise_assessment: {
          type: "string",
          enum: ["beginner", "intermediate", "expert"],
          description: "Your assessment of the audience's expertise based on their questions so far."
        }
      },
      required: ["spoken_text", "follow_ups", "expertise_assessment"]
    }
  }
};

export const toolDefinitions: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "navigate_to_slide",
      description:
        "Navigate to a specific slide when the user asks about a topic that is best explained elsewhere in the deck.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          slide_number: {
            type: "integer",
            enum: slideIds,
            description: "The slide number to navigate to.",
          },
        },
        required: ["slide_number"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "highlight_zone",
      description:
        "Highlight a diagram zone while explaining that specific component on the current slide.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          zone_id: {
            type: "string",
            enum: zoneIds,
            description:
              "The id of the slide diagram zone to highlight, such as think, api_tool, or safety_callout.",
          },
        },
        required: ["zone_id"],
      },
    },
  },
  respondToolDefinition,
];

export const respondOnlyToolDefinitions: ChatCompletionTool[] = [
  respondToolDefinition,
];
