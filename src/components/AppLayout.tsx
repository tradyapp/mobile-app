"use client";
import { Page, Tabbar, TabbarLink, ToolbarPane } from "konsta/react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigationStore } from "@/stores/navigationStore";
import OrionTab from "@/modules/tabs/OrionTab";
import ChartTab from "@/modules/tabs/ChartTab";
import LearnTab from "@/modules/tabs/LearnTab";
import { useWindowSize } from "@/hooks/useWindowSize";

import TouchableButton from "./uiux/TouchableButton";
import SearchIcon from "./icons/SearchIcon";
import LearnIcon from "./icons/LearnIcon";
import ChartIcon from "./icons/ChartIcon";
import OrionIcon from "./icons/OrionIcon";

const AppLayout = () => {
  const { currentTab, setCurrentTab } = useNavigationStore();
  const { width, height } = useWindowSize();
  const isLandscape = width > height;

  const tabs = [
    { id: "orion" as const, label: "Orion", icon: <OrionIcon/>, component: OrionTab },
    { id: "chart" as const, label: "Chart", icon: <ChartIcon/>, component: ChartTab },
    { id: "learn" as const, label: "Learn", icon: <LearnIcon />, component: LearnTab },
  ];

  const CurrentTabComponent =
    tabs.find((tab) => tab.id === currentTab)?.component || OrionTab;

  return (
    <Page>
      <div className="pb-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <CurrentTabComponent />
          </motion.div>
        </AnimatePresence>
      </div>

      <div
        className="fixed left-0 right-0 z-100"
        style={{
          bottom: "0px",
          transform: isLandscape ? "translateY(18px)" : "none",
        }}
      >
        <Tabbar labels={true} icons={true} className="pr-24">
          <ToolbarPane>
            {tabs.map((tab) => (
              <TabbarLink
                key={tab.id}
                active={currentTab === tab.id}
                onClick={() => setCurrentTab(tab.id)}
                icon={<span className="text-2xl">{tab.icon}</span>}
                label={tab.label}
              />
            ))}
          </ToolbarPane>
        </Tabbar>

        <div
          className="absolute right-4 md:left-1/2 md:ml-28 bottom-4 z-101"
          style={isLandscape ? { transform: "translateX(20px)" } : undefined}
        >
          <TouchableButton className="rounded-full ">
            <div className="w-16 h-16 flex items-center justify-center">
              <SearchIcon />
            </div>
          </TouchableButton>
        </div>
      </div>
    </Page>
  );
};

export default AppLayout;
