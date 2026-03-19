"use client";
import { Page, Tabbar, TabbarLink, ToolbarPane } from "konsta/react";
import { motion, AnimatePresence } from "framer-motion";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { useNavigationStore } from "@/stores/navigationStore";
import OrionTab from "@/modules/tabs/OrionTab";
import ChartTab from "@/modules/tabs/ChartTab";
import LearnTab from "@/modules/tabs/LearnTab";
import SearchTab from "@/modules/tabs/SearchTab";
import SearchIcon from "./icons/SearchIcon";
import LearnIcon from "./icons/LearnIcon";
import ChartIcon from "./icons/ChartIcon";
import OrionIcon from "./icons/OrionIcon";

const AppLayout = () => {
  const { currentTab, setCurrentTab } = useNavigationStore();
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = useMemo(() => ([
    { id: "orion" as const, label: "Orion", path: "/orion", icon: <OrionIcon/>, component: OrionTab },
    { id: "chart" as const, label: "Chart", path: "/chart", icon: <ChartIcon/>, component: ChartTab },
    { id: "learn" as const, label: "Learn", path: "/learn", icon: <LearnIcon />, component: LearnTab },
    { id: "search" as const, label: "Search", path: "/search", icon: <SearchIcon />, component: SearchTab },
  ]), []);

  const activeTab = useMemo(
    () => tabs.find((tab) => location.pathname.startsWith(tab.path)) ?? tabs[0],
    [tabs, location.pathname]
  );

  useEffect(() => {
    if (currentTab !== activeTab.id) {
      setCurrentTab(activeTab.id);
    }
  }, [activeTab.id, currentTab, setCurrentTab]);

  return (
    <Page>
      <div className="pb-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <Routes>
              {tabs.map((tab) => (
                <Route key={tab.id} path={`${tab.path}/*`} element={<tab.component />} />
              ))}
              <Route path="/" element={<Navigate to="/orion" replace />} />
              <Route path="*" element={<Navigate to="/orion" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 z-100"
        style={{ transform: "translateY(calc(env(safe-area-inset-bottom) / 2 + 6px))" }}
      >
        <Tabbar labels={true} icons={true}>
          <ToolbarPane>
            {tabs.map((tab) => (
              <TabbarLink
                key={tab.id}
                active={activeTab.id === tab.id}
                onClick={() => navigate(tab.path)}
                icon={<span className="text-2xl">{tab.icon}</span>}
                label={tab.label}
              />
            ))}
          </ToolbarPane>
        </Tabbar>
      </div>
    </Page>
  );
};

export default AppLayout;
