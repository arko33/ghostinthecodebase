import LandingPage from "@/src/components/site/LandingPage";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "GhostInTheCodebase",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  description:
    "Black-box recorder and time-travel autopsy for AI coding agents. Records every turn, attributes a regression to the exact prompt, and rolls the file back in one click.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "Shadow git commit per change burst",
    "Runtime metrics from /api/health",
    "Per-turn regression attribution",
    "One-click rollback and re-measurement",
    "Agent-agnostic recording",
  ],
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  );
}
