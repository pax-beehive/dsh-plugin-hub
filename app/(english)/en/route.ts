import { englishHomeRedirect } from "@/lib/en-redirect";

export function GET(request: Request) {
  return englishHomeRedirect(request);
}
