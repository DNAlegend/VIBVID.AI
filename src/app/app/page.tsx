import { UgcStudio } from "@/components/ugc/ugc-studio";

// The app opens straight on UGC Ads — the product. Rendered here (not
// redirected) so ?buy / ?purchase / auth query params survive on the home
// URL. The full studio still lives at /app/make.
export default function AppHomePage() {
  return <UgcStudio />;
}
