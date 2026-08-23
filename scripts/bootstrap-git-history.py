#!/usr/bin/env python3
"""Bootstrap exactly 50 git commits for initial Gemetra-XLM history."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Exactly 50 commits — Stellar/XLM focused history
COMMITS: list[tuple[str, list[str]]] = [
    ("chore: initialize repository with license and ignore rules", ["LICENSE", ".gitignore"]),
    ("chore: add package manifest and pnpm lockfile", ["package.json", "pnpm-lock.yaml", "package-lock.json", "skills-lock.json"]),
    ("chore: configure TypeScript and ESLint for the Vite app", ["tsconfig.json", "tsconfig.app.json", "tsconfig.node.json", "eslint.config.js"]),
    ("chore: add Vite build configuration and HTML shell", ["index.html", "vite.config.ts"]),
    ("chore: configure Vercel deployment for production builds", ["vercel.json"]),
    ("chore: set up Tailwind CSS and PostCSS", ["postcss.config.js", "tailwind.config.js"]),
    ("chore: document Stellar and Supabase environment variables", [".env.example"]),
    ("feat: add public static assets and XLM branding", ["public"]),
    ("feat: wire React entrypoint and global application styles", ["src/main.tsx", "src/App.tsx", "src/index.css"]),
    ("feat: add Stellar network and Horizon configuration", ["src/config/stellar.ts", "src/config/stellar.test.ts"]),
    ("feat: integrate Stellar Wallets Kit provider configuration", ["src/config/stellar-wallets.ts", "src/config/stellar-wallets.test.ts"]),
    ("feat: centralize treasury and admin Stellar public keys", ["src/config/treasury.ts"]),
    ("feat: implement core Stellar payment and address utilities", ["src/utils/stellar.ts"]),
    ("test: add Stellar utility and balance integration coverage", ["src/utils/stellar.test.ts", "src/utils/stellar-balance-integration.test.ts"]),
    ("feat: add React wallet context for Freighter and Albedo", ["src/utils/stellar-wallet.tsx", "src/utils/connect-wallet.tsx"]),
    ("feat: enforce XLM-only VAT refund filtering by G-address", ["src/utils/vatRefundPayments.ts"]),
    ("feat: add Gemetra Points calculation for XLM refund claims", ["src/utils/travelerPoints.ts"]),
    ("feat: add Supabase client with environment validation", ["src/lib"]),
    ("feat: add initial Postgres schema for wallet-keyed data", ["supabase/migrations/20260131000000_initial_schema.sql"]),
    ("feat: align Supabase defaults with native XLM on Stellar", ["supabase/migrations/20260223000000_stellar_only_cleanup.sql"]),
    ("refactor: remove legacy payroll schema from Supabase", ["supabase/migrations/20260223120000_drop_employees_payroll.sql"]),
    ("fix: purge invalid non-XLM rows from VAT refund payments", ["supabase/migrations/20260223130000_purge_non_xlm_vat_refunds.sql"]),
    ("feat: add admin cancel flow and claim blacklist migration", ["supabase/migrations/20260223140000_admin_cancel_blacklist.sql"]),
    ("chore: add Supabase local project configuration", ["supabase/config.toml", "supabase/.gitignore"]),
    ("feat: share CORS helpers for Supabase edge functions", ["supabase/functions/_shared"]),
    ("feat: add treasury edge function for signed XLM payouts", ["supabase/functions/treasury-payout"]),
    ("feat: add passport verification Supabase edge function", ["supabase/functions/verify-passport"]),
    ("feat: add local Vite plugin for dev treasury XLM signing", ["vite-plugin-treasury-dev.ts"]),
    ("feat: implement treasury payout client service", ["src/services/treasuryPayout.ts"]),
    ("feat: add claim blacklist enforcement service", ["src/services/claimBlacklist.ts"]),
    ("feat: add passport MRZ parsing OCR and validation pipeline", ["src/services/passportVerification"]),
    ("feat: add Gemini AI assistant with VAT and Stellar context", ["src/services/aiService.ts", "src/services/priceService.ts", "src/services/textProcessingService.ts"]),
    ("feat: add usePayments hook with Supabase persistence", ["src/hooks/usePayments.ts", "src/hooks/usePayments.test.ts"]),
    ("feat: add usePoints and useChat hooks for rewards and assistant", ["src/hooks/usePoints.ts", "src/hooks/useChat.ts"]),
    ("feat: add wallet-scoped notifications and auth hooks", ["src/hooks/useNotifications.ts", "src/hooks/useAuth.ts"]),
    ("feat: add Gemetra design tokens and primary navigation shell", ["src/gemetra-ui/tokens.css", "src/gemetra-ui/index.ts", "src/gemetra-ui/GemetraButton.tsx", "src/gemetra-ui/AppNav.tsx", "src/gemetra-ui/BottomNav.tsx", "src/gemetra-ui/GemetraLogo.tsx", "src/gemetra-ui/GemetraNavbar.tsx", "src/gemetra-ui/GemetraFooter.tsx"]),
    ("feat: add VAT country math for 53 Stellar refund jurisdictions", ["src/gemetra-ui/vatClaimMath.ts", "src/gemetra-ui/vatClaimMath.test.ts", "src/gemetra-ui/vatCountries.ts"]),
    ("feat: add country explore and document upload UI modules", ["src/gemetra-ui/CountryExploreCard.tsx", "src/gemetra-ui/CountryExploreDetail.tsx", "src/gemetra-ui/CountryRefundDetailPanel.tsx", "src/gemetra-ui/DocumentUploadHero.tsx", "src/gemetra-ui/atlysAssets.ts", "src/gemetra-ui/AtlysFilterBar.tsx", "src/gemetra-ui/AtlysIndexNavbar.tsx", "src/gemetra-ui/ExploreNav.tsx"]),
    ("feat: add marketing carousel and timeline presentation components", ["src/gemetra-ui/GemetraTimeline.tsx", "src/gemetra-ui/HeroRefundCard.tsx", "src/gemetra-ui/PassportCarousel.tsx", "src/gemetra-ui/PassportCoverImage.tsx", "src/gemetra-ui/ProcessRoadmap.tsx", "src/gemetra-ui/ReviewsCarousel.tsx", "src/gemetra-ui/VideoPromoBanner.tsx", "src/gemetra-ui/GemetraComparison.tsx", "src/gemetra-ui/GemetraTabs.tsx", "src/gemetra-ui/VisaStyleTabs.tsx", "src/gemetra-ui/ChatMessageBubble.tsx", "src/gemetra-ui/aiSuggestions.ts"]),
    ("feat: add application shell routing and dashboard overview", ["src/app/AppShell.tsx", "src/components/Dashboard.tsx", "src/components/MainLandingPage.tsx", "src/components/LandingPage.tsx", "src/components/RecentActivity.tsx", "src/components/AllActivityPages.tsx"]),
    ("feat: add VAT refund submission flow with treasury payout", ["src/components/VATRefundPage.tsx", "src/components/VATRefundWizardLayout.tsx", "src/components/VATRefundOverview.tsx", "src/components/PassportVerificationPanel.tsx"]),
    ("feat: add refund history and admin operations dashboards", ["src/components/RefundHistoryPage.tsx", "src/components/VATAdminPage.tsx"]),
    ("feat: add AI assistant settings and wallet connection UI", ["src/components/AIAssistantPage.tsx", "src/components/ChatHistoryPage.tsx", "src/components/SettingsPage.tsx", "src/components/WalletModal.tsx", "src/components/AuthPage.tsx"]),
    ("feat: add points display and application layout chrome", ["src/components/PointsDisplay.tsx", "src/components/TokenBalance.tsx", "src/components/DashboardLayout.tsx", "src/components/Header.tsx", "src/components/Sidebar.tsx", "src/components/TopBar.tsx", "src/components/NotificationDropdown.tsx", "src/components/Icons.tsx", "src/components/Squares.tsx", "src/components/Squares.css"]),
    ("feat: add Subframe UI kit for forms charts and navigation", ["src/ui"]),
    ("feat: add Soroban vat-refund registry contract workspace", ["contracts"]),
    ("docs: add README and Stellar architecture documentation", ["README.md", "docs"]),
    ("chore: add VAT receipt samples for Stellar wallet testing", ["samples"]),
    ("chore: add Stellar development and wallet utility scripts", ["scripts"]),
    ("chore: add Stellar agent skills and Cursor project context", [".agents", ".cursor"]),
]

assert len(COMMITS) == 50, f"Expected 50 commits, got {len(COMMITS)}"


def run(cmd: list[str], cwd: Path) -> None:
    subprocess.run(cmd, cwd=cwd, check=True)


def main() -> None:
    try:
        run(["git", "rev-parse", "HEAD"], ROOT)
        print("Repository already has commits.", file=sys.stderr)
        sys.exit(1)
    except subprocess.CalledProcessError:
        pass

    for i, (msg, paths) in enumerate(COMMITS, 1):
        existing = [p for p in paths if (ROOT / p).exists()]
        if not existing:
            print(f"[{i}] skip missing: {msg}", file=sys.stderr)
            sys.exit(1)
        run(["git", "add", *existing], ROOT)
        diff = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT)
        if diff.returncode == 0:
            print(f"[{i}] empty commit blocked: {msg}", file=sys.stderr)
            sys.exit(1)
        run(["git", "commit", "-m", msg], ROOT)
        print(f"[{i}/50] {msg}")

    leftover = subprocess.check_output(["git", "ls-files", "--others", "--exclude-standard"], cwd=ROOT, text=True).strip()
    if leftover:
        print("Untracked files remain:", leftover, file=sys.stderr)
        sys.exit(1)

    count = subprocess.check_output(["git", "rev-list", "--count", "HEAD"], cwd=ROOT, text=True).strip()
    print(f"Done. Total commits: {count}")


if __name__ == "__main__":
    main()
