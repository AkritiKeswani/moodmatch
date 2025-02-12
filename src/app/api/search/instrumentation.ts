import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";
import * as OpenAI from "openai";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { Resource } from "@opentelemetry/resources";


import * as dotenv from 'dotenv';
dotenv.config();


// For troubleshooting, set the log level to DiagLogLevel.DEBUG
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

const provider = new NodeTracerProvider({
  resource: new Resource({
    ["openinference.project.name"]: "MoodMatch",
  }),
  // sampler: {
  //   shouldSample(context, traceId, spanName, spanKind, attributes) {
  //     // Only filter out Next.js internal spans while keeping OpenInference spans
  //     if (attributes?.['next.span_name'] && !attributes?.['openinference.span.kind']) {
  //       return {
  //         decision: 0
  //       };
  //     }
  //     return {
  //       decision: 1
  //     };
  //   }
  // }
});

provider.addSpanProcessor(
  new SimpleSpanProcessor(
    new OTLPTraceExporter({
      url: process.env.PHOENIX_COLLECTOR_ENDPOINT || "http://localhost:6006/v1/traces",
    }),
  ),
);

// OpenAI must be manually instrumented as it doesn't have a traditional module structure
const openAIInstrumentation = new OpenAIInstrumentation({});
openAIInstrumentation.manuallyInstrument(OpenAI);

registerInstrumentations({
  instrumentations: [openAIInstrumentation],
});

provider.register();

diag.info("👀 OpenInference initialized");