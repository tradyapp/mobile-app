"use client";
import { Block, BlockTitle } from "konsta/react";
import AppNavbar from "@/components/AppNavbar";
import MessageIcon from "@/components/icons/MessageIcon";

export default function LearnTab() {
  return (
    <>
      <AppNavbar
        left={
          <button className="w-10 h-10 flex items-center justify-center">
            <MessageIcon />
          </button>
        }
        title="Learn"
      />
      <Block strong inset>
        <BlockTitle>Learn</BlockTitle>
        <p className="text-center py-8">Página de Learn</p>
      </Block>
    </>
  );
}
