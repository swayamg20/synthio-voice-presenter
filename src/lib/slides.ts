import type { Slide } from "./types";

const slides: Slide[] = [
  {
    id: 1,
    title: "What Are AI Agents?",
    subtitle: "From text generators to autonomous actors",
    layout: "split",
    bullets: [
      "LLMs generate text — agents take action",
      "An agent = LLM + Tools + Goals",
      "They can observe, reason, and interact with the world",
    ],
    zones: [
      {
        id: "llm_box",
        label: "Large Language Model",
        description:
          "A neural network that generates text based on input prompts. By itself, it can explain, draft, summarize, and reason in language, but it cannot directly change anything outside the chat.",
        svgElementId: "llm_box",
      },
      {
        id: "agent_box",
        label: "AI Agent",
        description:
          "An LLM enhanced with tools, memory, goals, and control logic so it can choose actions, call external systems, observe results, and keep working toward an outcome.",
        svgElementId: "agent_box",
      },
      {
        id: "difference_arrow",
        label: "The Key Difference",
        description:
          "Agents bridge the gap between generating text and taking real-world actions. The arrow represents the shift from describing what should happen to actually using tools to make it happen.",
        svgElementId: "difference_arrow",
      },
    ],
    narrationHint:
      "Start by meeting the audience where they are: most people think of AI as a chatbot that produces text in response to a prompt. Then make the contrast concrete: an LLM can describe how to book a flight, while an agent can check dates, compare options, ask for confirmation, and complete the booking through tools. Emphasize the simple formula - LLM plus tools plus goals - and make it clear that agency is about taking useful action, not just sounding intelligent.",
  },
  {
    id: 2,
    title: "The Agent Loop",
    subtitle: "Observe, Think, Act — Repeat",
    layout: "circular",
    bullets: [
      "Observe: Perceive the environment",
      "Think: Reason about the next action",
      "Act: Execute using tools",
      "A simple loop that creates emergent complexity",
    ],
    zones: [
      {
        id: "observe",
        label: "Observe",
        description:
          "The agent reads the current situation: the user's request, conversation history, page state, tool results, errors, files, API responses, or any other signal available in its environment.",
        svgElementId: "observe",
      },
      {
        id: "think",
        label: "Think",
        description:
          "The LLM interprets the observation, compares it to the goal, considers constraints, chooses a strategy, and decides which action or tool call is most likely to move the task forward.",
        svgElementId: "think",
      },
      {
        id: "act",
        label: "Act",
        description:
          "The agent executes the chosen step: calling an API, querying a database, writing code, clicking through an interface, asking a clarifying question, or returning an answer to the user.",
        svgElementId: "act",
      },
      {
        id: "feedback_arrow",
        label: "Feedback Loop",
        description:
          "Every action produces a new result, and that result becomes the next observation. This repeated feedback loop lets simple steps compound into complex, adaptive behavior.",
        svgElementId: "feedback_arrow",
      },
    ],
    narrationHint:
      "Explain the loop as the smallest useful mental model for agents: observe, think, act, then observe again. Use the chef analogy throughout - the chef checks the order and available ingredients, plans the next move, cooks, tastes, adjusts, and keeps looping until the dish is ready. Stress that no single step is magical; the power comes from repetition, feedback, and the model's ability to adapt each next action to what just happened.",
  },
  {
    id: 3,
    title: "Tool Calling",
    subtitle: "How Agents Interact with the World",
    layout: "radial",
    bullets: [
      "Function calling lets LLMs use external tools",
      "APIs, databases, code execution, web search",
      "The LLM decides WHAT to call and WITH WHAT arguments",
      "Tools are the hands of the agent",
    ],
    zones: [
      {
        id: "agent_core",
        label: "Agent Core",
        description:
          "The LLM-driven decision center that reads the goal, understands available tool schemas, selects the right tool, supplies arguments, and interprets the results.",
        svgElementId: "agent_core",
      },
      {
        id: "api_tool",
        label: "API Tool",
        description:
          "A connection to external services such as calendars, payment providers, travel systems, CRMs, or internal business APIs. API tools let the agent create, update, and retrieve real data.",
        svgElementId: "api_tool",
      },
      {
        id: "code_tool",
        label: "Code Tool",
        description:
          "A controlled execution environment where the agent can run scripts, inspect files, transform data, test hypotheses, and verify work with programmatic feedback.",
        svgElementId: "code_tool",
      },
      {
        id: "search_tool",
        label: "Search Tool",
        description:
          "A way to retrieve current or external information beyond the model's static training data, such as web pages, documentation, news, or research material.",
        svgElementId: "search_tool",
      },
      {
        id: "db_tool",
        label: "Database Tool",
        description:
          "A structured data interface for reading and writing records, querying state, storing workflow progress, and grounding the agent's decisions in authoritative data.",
        svgElementId: "db_tool",
      },
    ],
    narrationHint:
      "Frame tool calling as the moment an LLM stops being a brain in a jar and gains hands. Walk through a concrete task, such as planning a customer visit: the agent searches for context, calls a calendar API for availability, queries a CRM for account notes, maybe runs code to compare time slots, and then drafts or sends the final message. Make clear that the model does not magically access everything; developers expose specific tools, schemas, and permissions, and the model chooses what to call and which arguments to pass.",
  },
  {
    id: 4,
    title: "Memory & Context",
    subtitle: "How Agents Remember",
    layout: "stack",
    bullets: [
      "Short-term: conversation history and working context",
      "Long-term: vector stores, RAG, persistent knowledge",
      "Without memory, agents are goldfish",
      "Memory enables multi-step reasoning",
    ],
    zones: [
      {
        id: "short_term",
        label: "Short-Term Memory",
        description:
          "The immediate working context: the current conversation, recent tool outputs, active instructions, partial plans, and the details needed to complete the next few steps.",
        svgElementId: "short_term",
      },
      {
        id: "long_term",
        label: "Long-Term Memory",
        description:
          "Persistent knowledge that survives beyond one prompt or session, such as user preferences, project history, product documentation, prior decisions, and reusable facts.",
        svgElementId: "long_term",
      },
      {
        id: "rag_arrow",
        label: "Retrieval Path",
        description:
          "Retrieval-augmented generation connects the immediate prompt to long-term knowledge by finding relevant stored material and injecting it into the model's context before it answers or acts.",
        svgElementId: "rag_arrow",
      },
      {
        id: "vector_store",
        label: "Vector Store",
        description:
          "A searchable memory index where documents, notes, or events are embedded by meaning, letting the agent retrieve information that is semantically related rather than only exact keyword matches.",
        svgElementId: "vector_store",
      },
    ],
    narrationHint:
      "Compare agent memory to human memory. Short-term memory is the notepad on the desk: what was just said, what tool result came back, and what step is next. Long-term memory is the library: durable knowledge the agent can look up when needed. Explain RAG in plain language as looking something up in a trusted book when you do not already know the answer. Land the point that without memory, agents restart from scratch too often; with memory, they can carry context across multi-step work.",
  },
  {
    id: 5,
    title: "Real-World Agents",
    subtitle: "Already in Production",
    layout: "cards",
    bullets: [
      "Coding agents write and debug software",
      "Research agents synthesize information from many sources",
      "Support agents handle customer queries end-to-end",
      "Not science fiction — deployed at scale today",
    ],
    zones: [
      {
        id: "coding_card",
        label: "Coding Agent",
        description:
          "A software development agent that reads a codebase, edits files, runs tests, investigates failures, and iterates with developer oversight. Examples include Copilot-style assistants and terminal coding agents.",
        svgElementId: "coding_card",
      },
      {
        id: "research_card",
        label: "Research Agent",
        description:
          "An agent that searches across papers, documentation, reports, and web sources, then compares claims, extracts findings, cites evidence, and summarizes what matters for a decision.",
        svgElementId: "research_card",
      },
      {
        id: "support_card",
        label: "Support Agent",
        description:
          "A customer support agent that understands a user's issue, checks account and policy data, performs approved actions like refunds or replacements, and escalates edge cases to humans.",
        svgElementId: "support_card",
      },
    ],
    narrationHint:
      "Make this slide feel grounded and current. Give specific examples: coding agents such as Copilot-style tools and Claude Code that can edit and debug software; research agents that read papers, documentation, and market data before synthesizing a brief; support agents that can look up an order, apply policy, issue a refund, and close the loop. Emphasize that these are not distant science fiction demos - they are production workflows already deployed with guardrails, logging, and human escalation paths.",
  },
  {
    id: 6,
    title: "Whats Next",
    subtitle: "The Future of AI Agents",
    layout: "timeline",
    bullets: [
      "Single agents → multi-agent teams",
      "Autonomous workflows with human oversight",
      "Safety and alignment become critical",
      "The agent era is just beginning",
    ],
    zones: [
      {
        id: "single",
        label: "Single Agent",
        description:
          "One agent owns the task loop, uses tools, and works toward a goal. This is the foundation most production agent systems start with because it is easier to supervise and debug.",
        svgElementId: "single",
      },
      {
        id: "multi",
        label: "Multi-Agent Teams",
        description:
          "Multiple specialized agents collaborate, review one another's work, divide responsibilities, and combine capabilities the way a team might have planners, builders, researchers, and reviewers.",
        svgElementId: "multi",
      },
      {
        id: "autonomous",
        label: "Autonomous Workflows",
        description:
          "Long-running workflows where agents can plan, execute, monitor progress, recover from errors, and ask for human approval only at important checkpoints or high-risk decisions.",
        svgElementId: "autonomous",
      },
      {
        id: "safety_callout",
        label: "Safety & Alignment",
        description:
          "As agents gain more tools and autonomy, systems need clear permissions, evaluation, audit trails, human oversight, rollback paths, and alignment with the user's real intent.",
        svgElementId: "safety_callout",
      },
    ],
    narrationHint:
      "End by widening the lens. Paint a believable near future where single agents become teams of specialized agents: one researches, one plans, one executes, one critiques. Then ground the excitement with the central safety question: the more capable agents become, the more important permissions, oversight, evaluation, and alignment become. Close with an optimistic but thoughtful note - the agent era is early, the patterns are forming now, and the best systems will combine autonomy with responsible human control.",
  },
];

export default slides;
