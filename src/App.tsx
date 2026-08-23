
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useStellarWallet } from "./utils/stellar-wallet";
import { AppShell } from "./app/AppShell";
import AtlysLandingPage from "./pages/AtlysLandingPage";
import { VATIndexPage } from "./pages/VATIndexPage";

type PublicView = "landing" | "index";

function readIndexCountryFromHash(): string | null {
  const match = window.location.hash.match(/^#vat\/([A-Z]{2})$/i);
  return match ? match[1].toUpperCase() : null;
}

function readExploreCountryFromHash(): string | null {
  const match = window.location.hash.match(/^#explore\/([A-Z]{2})$/i);
  return match ? match[1].toUpperCase() : null;
}

function initialPublicView(): PublicView {
  if (window.location.hash === "#vat-index" || readIndexCountryFromHash()) return "index";
  return "landing";
}

function App() {
  const { walletState, connect } = useStellarWallet();
  const isConnected = walletState.isConnected;
  const [publicView, setPublicView] = useState<PublicView>(initialPublicView);
  const [indexCountryCode, setIndexCountryCode] = useState<string | null>(() => readIndexCountryFromHash());
  const [landingCountryCode, setLandingCountryCode] = useState<string | null>(() => readExploreCountryFromHash());
  const [browsePublic, setBrowsePublic] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("gemetra_active_tab") || "landing";
  });

  const goToLanding = () => {
    setBrowsePublic(true);
    setPublicView("landing");
    setLandingCountryCode(null);
    setIndexCountryCode(null);
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    window.scrollTo(0, 0);
  };

  const goToApp = (tab = 'dashboard') => {
    localStorage.setItem('gemetra_active_tab', tab);
    setActiveTab(tab);
    setBrowsePublic(false);
    window.scrollTo(0, 0);
  };

  const startRefundApplication = async () => {
    if (!walletState.isConnected) {
      await connect();
    }
    goToApp('vat-refund');
  };

  useEffect(() => {
    localStorage.setItem("gemetra_active_tab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (publicView === "index") {
      window.location.hash = indexCountryCode ? `vat/${indexCountryCode}` : "vat-index";
    } else if (publicView === "landing") {
      if (landingCountryCode) {
        window.location.hash = `explore/${landingCountryCode}`;
      } else if (window.location.hash.startsWith("#vat")) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
  }, [publicView, indexCountryCode, landingCountryCode]);

  useEffect(() => {
    const onHashChange = () => {
      const indexCode = readIndexCountryFromHash();
      const exploreCode = readExploreCountryFromHash();

      if (window.location.hash === "#vat-index") {
        setPublicView("index");
        setIndexCountryCode(null);
        return;
      }
      if (indexCode) {
        setPublicView("index");
        setIndexCountryCode(indexCode);
        return;
      }
      if (exploreCode) {
        setPublicView("landing");
        setLandingCountryCode(exploreCode);
        return;
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const openIndex = () => {
    setPublicView("index");
    setLandingCountryCode(null);
    window.scrollTo(0, 0);
  };

  const openExploreWithCountry = (code: string) => {
    setLandingCountryCode(code);
    setPublicView("landing");
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    if (isConnected && !browsePublic && (activeTab === "landing" || publicView === "landing")) {
      setActiveTab("dashboard");
    } else if (!isConnected && !["landing", "index"].includes(activeTab) && activeTab !== "dashboard") {
      setActiveTab("landing");
      setPublicView("landing");
      setBrowsePublic(true);
    }
  }, [isConnected, activeTab, publicView, browsePublic]);

  const renderConnected = () => (
    <AppShell
      onGoHome={goToLanding}
      featuredCountryCode={landingCountryCode ?? indexCountryCode}
    />
  );

  const renderPublic = () => {
    if (publicView === "index") {
      return (
        <VATIndexPage
          initialCountryCode={indexCountryCode}
          onBack={() => {
            setIndexCountryCode(null);
            setPublicView("landing");
          }}
          onOpenExplore={openExploreWithCountry}
        />
      );
    }
    return (
      <AtlysLandingPage
        initialCountryCode={landingCountryCode}
        onExploreIndex={openIndex}
        onCountrySelected={(code) => setLandingCountryCode(code)}
        onOpenDashboard={isConnected ? (tab) => goToApp(tab ?? 'dashboard') : undefined}
        onStartApplication={startRefundApplication}
      />
    );
  };

  return (
    <div className={`min-h-screen relative gem-sans ${!isConnected && publicView === "index" ? "bg-black" : "bg-white"}`}>
      <main className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={isConnected && !browsePublic ? "app" : publicView === "index" ? `index-${indexCountryCode ?? "all"}` : `landing-${landingCountryCode ?? "grid"}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {isConnected && !browsePublic ? renderConnected() : renderPublic()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
