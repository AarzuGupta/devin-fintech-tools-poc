import "server-only";
import { createRefundsApiClient } from "./client";
import { MOCK_SCENARIOS, type MockScenario } from "./mockServer";

/** Server-side client from environment config. `simulate` is a demo-only mock control. */
export function refundsApiFromEnv(simulate?: string) {
  const scenario = MOCK_SCENARIOS.includes(simulate as MockScenario) ? (simulate as MockScenario) : undefined;
  return createRefundsApiClient({
    baseUrl: process.env.REFUNDS_API_BASE_URL ?? "http://127.0.0.1:3000/api/mock-finance/v1",
    token: process.env.REFUNDS_API_TOKEN ?? "",
    scenario,
  });
}
